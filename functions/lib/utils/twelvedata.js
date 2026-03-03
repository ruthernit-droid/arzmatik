"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TD_EXCHANGE_DEFAULT = void 0;
exports.tdListStocks = tdListStocks;
exports.tdQuote = tdQuote;
exports.pickCompanyName = pickCompanyName;
exports.normalizeSymbol = normalizeSymbol;
exports.bistTickerFromSymbol = bistTickerFromSymbol;
const helpers_1 = require("./helpers");
const TD_EXCHANGE_DEFAULT = "XIST";
exports.TD_EXCHANGE_DEFAULT = TD_EXCHANGE_DEFAULT;
async function tdListStocks(exchange, apiKey) {
    const url = `https://api.twelvedata.com/stocks?exchange=${encodeURIComponent(exchange)}`;
    const data = await (0, helpers_1.withRetry)(() => tdFetchJson(url, apiKey), 3);
    return Array.isArray(data?.data) ? data.data : [];
}
async function tdQuote(symbol, apiKey) {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}`;
    return (0, helpers_1.withRetry)(() => tdFetchJson(url, apiKey), 3);
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
    if (data?.status === "error") {
        throw new Error(`TwelveData error: ${data?.message || "unknown"}`);
    }
    return data;
}
function pickCompanyName(item, symbol) {
    return String(item?.name || item?.instrument_name || item?.company || symbol).trim() || symbol;
}
function normalizeSymbol(item) {
    const symbol = (0, helpers_1.upper)(item?.symbol);
    return symbol;
}
function bistTickerFromSymbol(symbol) {
    return symbol.replace(/\.IS$/i, "");
}
