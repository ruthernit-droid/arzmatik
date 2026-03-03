import { asNum, withRetry, upper } from "./helpers";

const TD_EXCHANGE_DEFAULT = "XIST";

export async function tdListStocks(exchange: string, apiKey: string) {
  const url = `https://api.twelvedata.com/stocks?exchange=${encodeURIComponent(exchange)}`;
  const data = await withRetry(() => tdFetchJson(url, apiKey), 3);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function tdQuote(symbol: string, apiKey: string) {
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}`;
  return withRetry(() => tdFetchJson(url, apiKey), 3);
}

async function tdFetchJson(url: string, apiKey: string) {
  const u = new URL(url);
  if (!u.searchParams.get("apikey")) u.searchParams.set("apikey", apiKey);
  const res = await fetch(u.toString(), { headers: { "User-Agent": "halka-arz-matik" } });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
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

export function pickCompanyName(item: any, symbol: string) {
  return String(item?.name || item?.instrument_name || item?.company || symbol).trim() || symbol;
}

export function normalizeSymbol(item: any) {
  const symbol = upper(item?.symbol);
  return symbol;
}

export function bistTickerFromSymbol(symbol: string) {
  return symbol.replace(/\.IS$/i, "");
}

export { TD_EXCHANGE_DEFAULT };
