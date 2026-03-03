"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncXistStocks = exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const TWELVEDATA_API_KEY = (0, params_1.defineSecret)("TWELVEDATA_API_KEY");
const TD_EXCHANGE_DEFAULT = "XIST";
const TD_LIMITS = {
    // Keep under free tier; adjust as needed.
    quotePerUserPerDay: 650,
    importPerUserPerDay: 3,
    importAllPerUserPerDay: 5,
};
const CACHE_TTL_SECONDS = {
    quote: 60,
    stocks: 12 * 60 * 60,
};
function cors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
function asNum(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
}
function upper(x) {
    return String(x || "").trim().toUpperCase();
}
function toBistSymbol(ticker) {
    // Twelve Data XIST stock symbols are plain tickers (e.g. THYAO), not .IS.
    const t = upper(ticker);
    if (!t)
        return "";
    return t.replace(/\.IS$/i, "");
}
async function sleep(ms) {
    await new Promise((r) => setTimeout(r, ms));
}
async function withRetry(fn, tries = 3) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
        try {
            return await fn();
        }
        catch (e) {
            lastErr = e;
            const msg = String(e?.message || e);
            // Backoff for transient network or rate limiting.
            const wait = msg.includes("429") ? 1200 : 400 * (i + 1);
            await sleep(wait);
        }
    }
    throw lastErr;
}
async function getUidFromRequest(req) {
    const hdr = String(req.get("Authorization") || "");
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m)
        return null;
    const token = m[1];
    try {
        const decoded = await (0, auth_1.getAuth)().verifyIdToken(token);
        return decoded.uid;
    }
    catch {
        return null;
    }
}
function dayKey(d = new Date()) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
}
async function consumeQuota(uid, kind, maxPerDay) {
    const key = `td_${kind}_${uid}_${dayKey()}`;
    const ref = db.collection("rate").doc(key);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists ? asNum(snap.data()?.count, 0) : 0;
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
async function cacheGet(key) {
    const ref = db.collection("api_cache").doc(key);
    const snap = await ref.get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    const exp = data?.expiresAt;
    if (typeof exp === "string") {
        const t = new Date(exp).getTime();
        if (!Number.isFinite(t) || Date.now() > t)
            return null;
    }
    return data?.value ?? null;
}
async function cacheSet(key, value, ttlSeconds) {
    const ref = db.collection("api_cache").doc(key);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await ref.set({
        value,
        expiresAt,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
}
async function tdFetchJson(url, apiKey) {
    const u = new URL(url);
    if (!u.searchParams.get("apikey"))
        u.searchParams.set("apikey", apiKey);
    const res = await fetch(u.toString(), { headers: { "User-Agent": "halka-arz-matik" } });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`TwelveData non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
        throw new Error(`TwelveData HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
    // TwelveData uses { status: "error", message: ... }
    if (data?.status === "error") {
        throw new Error(`TwelveData error: ${data?.message || "unknown"}`);
    }
    return data;
}
async function tdListStocks(exchange, apiKey) {
    // Docs: https://twelvedata.com/docs#stocks
    const url = `https://api.twelvedata.com/stocks?exchange=${encodeURIComponent(exchange)}`;
    const data = await withRetry(() => tdFetchJson(url, apiKey), 3);
    return Array.isArray(data?.data) ? data.data : [];
}
async function tdQuote(symbol, apiKey) {
    // Docs: https://twelvedata.com/docs#quote
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}`;
    return withRetry(() => tdFetchJson(url, apiKey), 3);
}
function pickCompanyName(item, symbol) {
    return String(item?.name || item?.instrument_name || item?.company || symbol).trim() || symbol;
}
function normalizeSymbol(item) {
    // Twelve Data returns symbols like THYAO.IS for XIST.
    const symbol = upper(item?.symbol);
    return symbol;
}
function bistTickerFromSymbol(symbol) {
    return symbol.replace(/\.IS$/i, "");
}
function decodeHtmlEntities(input) {
    return input
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
}
function stripTags(input) {
    return decodeHtmlEntities(String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}
function slugFromUrl(url) {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        return parts[0] || "";
    }
    catch {
        return "";
    }
}
async function discoverIposFromHalkarz(maxItems = 40) {
    const html = await withRetry(async () => {
        const res = await fetch("https://halkarz.com/", {
            headers: { "User-Agent": "halka-arz-matik-bot" },
        });
        if (!res.ok)
            throw new Error(`halkarz HTTP ${res.status}`);
        return res.text();
    }, 3);
    const listStart = html.indexOf('<ul class="halka-arz-list">');
    if (listStart < 0)
        return [];
    const listEnd = html.indexOf("<div class=\"misha_loadmore\"", listStart);
    const section = listEnd > listStart ? html.slice(listStart, listEnd) : html.slice(listStart);
    const blocks = section.match(/<article class="index-list">[\s\S]*?<\/article>/g) || [];
    const out = [];
    for (const block of blocks) {
        const linkMatch = block.match(/<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
            || block.match(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*><img/i);
        const tickerMatch = block.match(/<span class="il-bist-kod">([\s\S]*?)<\/span>/i);
        const dateMatch = block.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
        const statusMatch = block.match(/<div class="il-tt">([\s\S]*?)<\/div>/i);
        const link = linkMatch?.[1] ? decodeHtmlEntities(linkMatch[1]) : "";
        const companyNameRaw = linkMatch?.[2] ? stripTags(linkMatch[2]) : "";
        const companyName = companyNameRaw || "Bilinmeyen Sirket";
        const ticker = upper(stripTags(tickerMatch?.[1] || "")).replace(/[^A-Z0-9]/g, "");
        const dateText = stripTags(dateMatch?.[1] || "");
        const statusText = stripTags(statusMatch?.[1] || "");
        const slug = slugFromUrl(link);
        if (!link || !slug || !ticker)
            continue;
        out.push({ slug, link, companyName, ticker, dateText, statusText });
        if (out.length >= maxItems)
            break;
    }
    return out;
}
async function applyDiscoveredIpos(items) {
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    for (const item of items) {
        const docId = `ipo_ha_${item.slug}`;
        const ref = db.collection("ipos").doc(docId);
        const snap = await ref.get();
        const payload = {
            companyName: item.companyName,
            ticker: item.ticker,
            status: "Talep Toplanıyor",
            ipoDateText: item.dateText,
            source: "halkarz",
            sourceLink: item.link,
            sourceStatusText: item.statusText,
            isIpo: true,
            updatedAt: now,
        };
        if (!snap.exists) {
            payload.createdAt = now;
            created++;
        }
        else {
            updated++;
        }
        await ref.set(payload, { merge: true });
    }
    return { created, updated };
}
async function writeIposFromStocksList(list, exchange) {
    const now = new Date().toISOString();
    let batch = db.batch();
    let writes = 0;
    for (const item of list) {
        const symbol = normalizeSymbol(item);
        if (!symbol)
            continue;
        const name = pickCompanyName(item, symbol);
        const ref = db.collection("ipos").doc(symbol);
        batch.set(ref, {
            ticker: bistTickerFromSymbol(symbol),
            symbol,
            companyName: name,
            status: "Borsada İşlem Görüyor",
            exchange,
            source: "twelvedata",
            // Keep a snapshot of provider metadata for reference.
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
exports.api = (0, https_1.onRequest)({
    region: "europe-west1",
    secrets: [TWELVEDATA_API_KEY],
    timeoutSeconds: 120,
    memory: "512MiB",
}, async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS")
        return res.status(204).send("");
    const apiKey = TWELVEDATA_API_KEY.value();
    const rawPath = req.path || "/";
    // Firebase Hosting rewrites keep the original path (e.g. /api/twelve/quote).
    const path = rawPath.startsWith("/api/") ? rawPath.slice(4) : rawPath;
    const uid = await getUidFromRequest(req);
    try {
        // GET /api/twelve/stocks?exchange=XIST
        if (req.method === "GET" && path === "/twelve/stocks") {
            const exchange = upper(req.query.exchange || TD_EXCHANGE_DEFAULT) || TD_EXCHANGE_DEFAULT;
            const cacheKey = `td_stocks_${exchange}`;
            const cached = await cacheGet(cacheKey);
            if (cached) {
                return res.json({ exchange, cached: true, count: cached.length, data: cached });
            }
            const list = await tdListStocks(exchange, apiKey);
            await cacheSet(cacheKey, list, CACHE_TTL_SECONDS.stocks);
            return res.json({ exchange, cached: false, count: list.length, data: list });
        }
        // GET /api/twelve/quote?ticker=THYAO
        if (req.method === "GET" && path === "/twelve/quote") {
            const ticker = String(req.query.ticker || "");
            const symbol = toBistSymbol(ticker);
            if (!symbol)
                return res.status(400).json({ error: "missing ticker" });
            const cacheKey = `td_quote_${symbol}`;
            const cached = await cacheGet(cacheKey);
            if (cached) {
                return res.json({ ticker: upper(ticker), symbol, price: asNum(cached?.price, 0), cached: true });
            }
            // Rate-limit only when we actually call Twelve Data.
            if (uid) {
                await consumeQuota(uid, "quote", TD_LIMITS.quotePerUserPerDay);
            }
            const q = await tdQuote(symbol, apiKey);
            const price = asNum(q?.close, asNum(q?.price, 0));
            const payload = { price, raw: q, fetchedAt: new Date().toISOString() };
            await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS.quote);
            return res.json({ ticker: upper(ticker), symbol, price, cached: false });
        }
        // POST /api/twelve/import
        // Body: { exchange?: "XIST", withPrices?: boolean, limit?: number, offset?: number }
        // Writes to Firestore collection: ipos
        if (req.method === "POST" && path === "/twelve/import") {
            if (!uid)
                return res.status(401).json({ error: "auth required" });
            await consumeQuota(uid, "import", TD_LIMITS.importPerUserPerDay);
            const exchange = upper(req.body?.exchange || TD_EXCHANGE_DEFAULT) || TD_EXCHANGE_DEFAULT;
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
                written = slice.filter((it) => !!normalizeSymbol(it)).length;
            }
            else {
                // With prices: per-symbol quote is expensive; keep it limited/offset.
                const now = new Date().toISOString();
                for (const item of slice) {
                    const symbol = normalizeSymbol(item);
                    if (!symbol)
                        continue;
                    const name = pickCompanyName(item, symbol);
                    const ref = db.collection("ipos").doc(symbol);
                    const base = {
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
                        const price = asNum(q?.close, asNum(q?.price, 0));
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
                    await sleep(100);
                }
            }
            return res.json({ exchange, total: list.length, offset, limit, written, priced, failedPrices });
        }
        // POST /api/twelve/import_all
        // Body: { exchange?: "XIST" }
        // Writes full exchange stock list (metadata) to Firestore. One-time baseline.
        if (req.method === "POST" && path === "/twelve/import_all") {
            if (!uid)
                return res.status(401).json({ error: "auth required" });
            await consumeQuota(uid, "import_all", TD_LIMITS.importAllPerUserPerDay);
            const exchange = upper(req.body?.exchange || TD_EXCHANGE_DEFAULT) || TD_EXCHANGE_DEFAULT;
            const list = await tdListStocks(exchange, apiKey);
            await writeIposFromStocksList(list, exchange);
            return res.json({ exchange, total: list.length, written: list.length });
        }
        // POST /api/ipo/discover_halkarz
        // Body: { apply?: boolean, max?: number }
        if (req.method === "POST" && path === "/ipo/discover_halkarz") {
            if (!uid)
                return res.status(401).json({ error: "auth required" });
            const apply = !!req.body?.apply;
            const max = Math.max(1, Math.min(100, Number(req.body?.max || 40)));
            const discovered = await discoverIposFromHalkarz(max);
            if (!apply) {
                return res.json({ source: "halkarz", discovered: discovered.length, data: discovered });
            }
            const result = await applyDiscoveredIpos(discovered);
            return res.json({ source: "halkarz", discovered: discovered.length, ...result });
        }
        return res.status(404).json({ error: "not found", path, method: req.method });
    }
    catch (e) {
        console.error(e);
        const msg = String(e?.message || e);
        const status = msg.includes("Rate limit exceeded") ? 429 : 500;
        return res.status(status).json({ error: msg });
    }
});
// Optional: background sync (requires Blaze + scheduler enabled).
// Keeps `ipos` seeded with the latest XIST stock list.
exports.syncXistStocks = (0, scheduler_1.onSchedule)({
    region: "europe-west1",
    secrets: [TWELVEDATA_API_KEY],
    schedule: "every 60 minutes",
    timeoutSeconds: 300,
    memory: "512MiB",
}, async () => {
    const apiKey = TWELVEDATA_API_KEY.value();
    const exchange = TD_EXCHANGE_DEFAULT;
    const list = await tdListStocks(exchange, apiKey);
    await writeIposFromStocksList(list, exchange);
});
