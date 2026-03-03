"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeIposFromStocksList = writeIposFromStocksList;
exports.handleStocks = handleStocks;
exports.handleQuote = handleQuote;
exports.handleImport = handleImport;
exports.handleImportAll = handleImportAll;
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const params_1 = require("firebase-functions/params");
const twelvedata_1 = require("../utils/twelvedata");
const helpers_1 = require("../utils/helpers");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const TWELVEDATA_API_KEY = (0, params_1.defineSecret)("TWELVEDATA_API_KEY");
const TD_LIMITS = {
    quotePerUserPerDay: 650,
    importPerUserPerDay: 3,
    importAllPerUserPerDay: 5,
};
const CACHE_TTL_SECONDS = {
    quote: 60,
    stocks: 12 * 60 * 60,
};
async function consumeQuota(uid, kind, maxPerDay) {
    const key = `td_${kind}_${uid}_${(0, helpers_1.dayKey)()}`;
    const ref = db.collection("rate").doc(key);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists ? (0, helpers_1.asNum)(snap.data()?.count, 0) : 0;
        if (current >= maxPerDay) {
            throw new Error(`Rate limit exceeded for ${kind}`);
        }
        tx.set(ref, {
            kind,
            uid,
            count: current + 1,
            day: (0, helpers_1.dayKey)(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    });
}
async function writeIposFromStocksList(list, exchange) {
    const now = new Date().toISOString();
    let batch = db.batch();
    let writes = 0;
    for (const item of list) {
        const symbol = (0, twelvedata_1.normalizeSymbol)(item);
        if (!symbol)
            continue;
        const name = (0, twelvedata_1.pickCompanyName)(item, symbol);
        const ref = db.collection("ipos").doc(symbol);
        batch.set(ref, {
            ticker: (0, twelvedata_1.bistTickerFromSymbol)(symbol),
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
async function handleStocks(req, res) {
    (0, helpers_1.cors)(res);
    if (req.method === "OPTIONS")
        return res.status(204).send("");
    const apiKey = TWELVEDATA_API_KEY.value();
    const exchange = req.query.exchange || twelvedata_1.TD_EXCHANGE_DEFAULT;
    const cacheKey = `td_stocks_${exchange}`;
    const cached = await (0, helpers_1.cacheGet)(cacheKey);
    if (cached) {
        return res.json({ exchange, cached: true, count: cached.length, data: cached });
    }
    const list = await (0, twelvedata_1.tdListStocks)(exchange, apiKey);
    await (0, helpers_1.cacheSet)(cacheKey, list, CACHE_TTL_SECONDS.stocks);
    return res.json({ exchange, cached: false, count: list.length, data: list });
}
async function handleQuote(req, res) {
    (0, helpers_1.cors)(res);
    if (req.method === "OPTIONS")
        return res.status(204).send("");
    const apiKey = TWELVEDATA_API_KEY.value();
    const ticker = String(req.query.ticker || "");
    const symbol = (0, twelvedata_1.bistTickerFromSymbol)(ticker);
    if (!symbol)
        return res.status(400).json({ error: "missing ticker" });
    const cacheKey = `td_quote_${symbol}`;
    const cached = await (0, helpers_1.cacheGet)(cacheKey);
    if (cached) {
        return res.json({ ticker: ticker.toUpperCase(), symbol, price: (0, helpers_1.asNum)(cached?.price, 0), cached: true });
    }
    const uid = await (0, helpers_1.getUidFromRequest)(req);
    if (uid) {
        await consumeQuota(uid, "quote", TD_LIMITS.quotePerUserPerDay);
    }
    const q = await (0, twelvedata_1.tdQuote)(symbol, apiKey);
    const price = (0, helpers_1.asNum)(q?.close, (0, helpers_1.asNum)(q?.price, 0));
    const payload = { price, raw: q, fetchedAt: new Date().toISOString() };
    await (0, helpers_1.cacheSet)(cacheKey, payload, CACHE_TTL_SECONDS.quote);
    return res.json({ ticker: ticker.toUpperCase(), symbol, price, cached: false });
}
async function handleImport(req, res) {
    (0, helpers_1.cors)(res);
    if (req.method === "OPTIONS")
        return res.status(204).send("");
    const uid = await (0, helpers_1.getUidFromRequest)(req);
    if (!uid)
        return res.status(401).json({ error: "auth required" });
    await consumeQuota(uid, "import", TD_LIMITS.importPerUserPerDay);
    const apiKey = TWELVEDATA_API_KEY.value();
    const exchange = req.body?.exchange || twelvedata_1.TD_EXCHANGE_DEFAULT;
    const withPrices = !!req.body?.withPrices;
    const limit = Math.max(1, Math.min(1000, Number(req.body?.limit || 500)));
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const list = await (0, twelvedata_1.tdListStocks)(exchange, apiKey);
    const slice = list.slice(offset, offset + limit);
    let written = 0;
    let priced = 0;
    let failedPrices = 0;
    if (!withPrices) {
        await writeIposFromStocksList(slice, exchange);
        written = slice.filter((it) => !!(0, twelvedata_1.normalizeSymbol)(it)).length;
    }
    else {
        const now = new Date().toISOString();
        for (const item of slice) {
            const symbol = (0, twelvedata_1.normalizeSymbol)(item);
            if (!symbol)
                continue;
            const name = (0, twelvedata_1.pickCompanyName)(item, symbol);
            const ref = db.collection("ipos").doc(symbol);
            const base = {
                ticker: (0, twelvedata_1.bistTickerFromSymbol)(symbol),
                symbol,
                companyName: name,
                status: "Borsada İşlem Görüyor",
                exchange,
                source: "twelvedata",
                provider: { twelvedata: item },
                updatedAt: now,
            };
            try {
                const q = await (0, twelvedata_1.tdQuote)(symbol, apiKey);
                const price = (0, helpers_1.asNum)(q?.close, (0, helpers_1.asNum)(q?.price, 0));
                if (price) {
                    base.price = price;
                    base.priceUpdatedAt = now;
                    priced++;
                }
            }
            catch {
                failedPrices++;
            }
            await ref.set(base, { merge: true });
            written++;
            await new Promise(r => setTimeout(r, 100));
        }
    }
    return res.json({ exchange, total: list.length, offset, limit, written, priced, failedPrices });
}
async function handleImportAll(req, res) {
    (0, helpers_1.cors)(res);
    if (req.method === "OPTIONS")
        return res.status(204).send("");
    const uid = await (0, helpers_1.getUidFromRequest)(req);
    if (!uid)
        return res.status(401).json({ error: "auth required" });
    await consumeQuota(uid, "import_all", TD_LIMITS.importAllPerUserPerDay);
    const apiKey = TWELVEDATA_API_KEY.value();
    const exchange = req.body?.exchange || twelvedata_1.TD_EXCHANGE_DEFAULT;
    const list = await (0, twelvedata_1.tdListStocks)(exchange, apiKey);
    await writeIposFromStocksList(list, exchange);
    return res.json({ exchange, total: list.length, written: list.length });
}
