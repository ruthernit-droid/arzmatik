import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { defineSecret } from "firebase-functions/params";
import { tdListStocks, tdQuote, pickCompanyName, normalizeSymbol, bistTickerFromSymbol, TD_EXCHANGE_DEFAULT } from "../utils/twelvedata";
import { cors, getUidFromRequest, cacheGet, cacheSet, dayKey, asNum as helpersAsNum } from "../utils/helpers";

const db = getFirestore();
const TWELVEDATA_API_KEY = defineSecret("TWELVEDATA_API_KEY");

const TD_LIMITS = {
  quotePerUserPerDay: 650,
  importPerUserPerDay: 3,
  importAllPerUserPerDay: 5,
};

const CACHE_TTL_SECONDS = {
  quote: 60,
  stocks: 12 * 60 * 60,
};

async function consumeQuota(uid: string, kind: "quote" | "import" | "import_all", maxPerDay: number) {
  const key = `td_${kind}_${uid}_${dayKey()}`;
  const ref = db.collection("rate").doc(key);

  await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? helpersAsNum(snap.data()?.count, 0) : 0;
    if (current >= maxPerDay) {
      throw new Error(`Rate limit exceeded for ${kind}`);
    }
    tx.set(ref, {
      kind,
      uid,
      count: current + 1,
      day: dayKey(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}

export async function writeIposFromStocksList(list: any[], exchange: string) {
  const now = new Date().toISOString();
  let batch = db.batch();
  let writes = 0;

  for (const item of list) {
    const symbol = normalizeSymbol(item);
    if (!symbol) continue;
    const name = pickCompanyName(item, symbol);

    const ref = db.collection("ipos").doc(symbol);
    batch.set(ref, {
      ticker: bistTickerFromSymbol(symbol),
      symbol,
      companyName: name,
      status: "Borsada İşlem Görüyor",
      exchange,
      source: "twelvedata",
      provider: {
        twelvedata: item,
      },
      updatedAt: now,
    }, { merge: true });

    writes++;
    if (writes >= 450) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }

  if (writes > 0) {
    await batch.commit();
  }
}

export async function handleStocks(req: any, res: any) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  const apiKey = TWELVEDATA_API_KEY.value();
  const exchange = req.query.exchange || TD_EXCHANGE_DEFAULT;
  const cacheKey = `td_stocks_${exchange}`;
  
  const cached = await cacheGet<any[]>(cacheKey);
  if (cached) {
    return res.json({ exchange, cached: true, count: cached.length, data: cached });
  }
  
  const list = await tdListStocks(exchange as string, apiKey);
  await cacheSet(cacheKey, list, CACHE_TTL_SECONDS.stocks);
  return res.json({ exchange, cached: false, count: list.length, data: list });
}

export async function handleQuote(req: any, res: any) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  const apiKey = TWELVEDATA_API_KEY.value();
  const ticker = String(req.query.ticker || "");
  const symbol = bistTickerFromSymbol(ticker);
  
  if (!symbol) return res.status(400).json({ error: "missing ticker" });
  
  const cacheKey = `td_quote_${symbol}`;
  const cached = await cacheGet<any>(cacheKey);
  if (cached) {
    return res.json({ ticker: ticker.toUpperCase(), symbol, price: helpersAsNum(cached?.price, 0), cached: true });
  }

  const uid = await getUidFromRequest(req);
  if (uid) {
    await consumeQuota(uid, "quote", TD_LIMITS.quotePerUserPerDay);
  }

  const q = await tdQuote(symbol, apiKey);
  const price = helpersAsNum(q?.close, helpersAsNum(q?.price, 0));
  const payload = { price, raw: q, fetchedAt: new Date().toISOString() };
  await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS.quote);
  return res.json({ ticker: ticker.toUpperCase(), symbol, price, cached: false });
}

export async function handleImport(req: any, res: any) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  const uid = await getUidFromRequest(req);
  if (!uid) return res.status(401).json({ error: "auth required" });

  await consumeQuota(uid, "import", TD_LIMITS.importPerUserPerDay);

  const apiKey = TWELVEDATA_API_KEY.value();
  const exchange = req.body?.exchange || TD_EXCHANGE_DEFAULT;
  const withPrices = !!req.body?.withPrices;
  const limit = Math.max(1, Math.min(1000, Number(req.body?.limit || 500)));
  const offset = Math.max(0, Number(req.body?.offset || 0));

  const list = await tdListStocks(exchange, apiKey);
  const slice = list.slice(offset, offset + limit);

  let written = 0;
  let priced = 0;
  let failedPrices = 0;

  if (!withPrices) {
    await writeIposFromStocksList(slice, exchange);
    written = slice.filter((it: any) => !!normalizeSymbol(it)).length;
  } else {
    const now = new Date().toISOString();
    for (const item of slice) {
      const symbol = normalizeSymbol(item);
      if (!symbol) continue;
      const name = pickCompanyName(item, symbol);
      const ref = db.collection("ipos").doc(symbol);

      const base: any = {
        ticker: bistTickerFromSymbol(symbol),
        symbol,
        companyName: name,
        status: "Borsada İşlem Görüyor",
        exchange,
        source: "twelvedata",
        provider: { twelvedata: item },
        updatedAt: now,
      };

      try {
        const q = await tdQuote(symbol, apiKey);
        const price = helpersAsNum(q?.close, helpersAsNum(q?.price, 0));
        if (price) {
          base.price = price;
          base.priceUpdatedAt = now;
          priced++;
        }
      } catch {
        failedPrices++;
      }

      await ref.set(base, { merge: true });
      written++;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return res.json({ exchange, total: list.length, offset, limit, written, priced, failedPrices });
}

export async function handleImportAll(req: any, res: any) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  const uid = await getUidFromRequest(req);
  if (!uid) return res.status(401).json({ error: "auth required" });

  await consumeQuota(uid, "import_all", TD_LIMITS.importAllPerUserPerDay);

  const apiKey = TWELVEDATA_API_KEY.value();
  const exchange = req.body?.exchange || TD_EXCHANGE_DEFAULT;
  const list = await tdListStocks(exchange, apiKey);
  await writeIposFromStocksList(list, exchange);
  return res.json({ exchange, total: list.length, written: list.length });
}
