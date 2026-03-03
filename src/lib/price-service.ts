type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
      };
    }>;
  };
};

function toSymbol(ticker: string) {
  const t = (ticker || "").trim().toUpperCase();
  if (!t) return "";
  return t.endsWith(".IS") ? t : `${t}.IS`;
}

async function fetchJson(url: string, timeoutMs: number = 15000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonViaAllOrigins(url: string): Promise<any> {
  // Some networks/adblockers block /raw. Fallback to /get which wraps in { contents }.
  const raw = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    return await fetchJson(raw);
  } catch (_e) {
    const get = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const wrapped = await fetchJson(get);
    const contents = wrapped?.contents;
    if (typeof contents !== "string") throw _e;
    return JSON.parse(contents);
  }
}

export async function fetchLatestPrice(ticker: string): Promise<number | null> {
  const symbol = toSymbol(ticker);
  if (!symbol) return null;

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

  // Static export runs on the client; Yahoo often blocks browser CORS.
  // Use a simple CORS proxy in the browser, direct fetch on the server.
  const data = (typeof window === "undefined"
    ? ((await fetchJson(yahooUrl)) as YahooChartResponse)
    : ((await fetchJsonViaAllOrigins(yahooUrl)) as YahooChartResponse));

  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}

export async function fetchLatestPriceTwelve(ticker: string): Promise<number | null> {
  const t = (ticker || "").trim().toUpperCase();
  if (!t) return null;
  try {
    const { auth } = await import("@/lib/firebase");
    const token = await auth?.currentUser?.getIdToken?.();
    const res = await fetch(`/api/twelve/quote?ticker=${encodeURIComponent(t)}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const price = Number(data?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    // Dev fallback (Next dev server has no Firebase Functions rewrite).
    return fetchLatestPrice(t);
  }
}

type YahooSearchResponse = {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    exchDisp?: string;
    quoteType?: string;
  }>;
};

export async function searchYahooBist(query: string): Promise<Array<{ ticker: string; symbol: string; name: string }>> {
  const q = (query || "").trim();
  if (!q) return [];

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0`;
  const data = (typeof window === "undefined"
    ? ((await fetchJson(url)) as YahooSearchResponse)
    : ((await fetchJsonViaAllOrigins(url)) as YahooSearchResponse));
  const quotes = data?.quotes || [];

  return quotes
    .filter((x) => (x?.exchange || x?.exchDisp) === "IST")
    .map((x) => {
      const symbol = String(x?.symbol || "").toUpperCase();
      const ticker = symbol.endsWith(".IS") ? symbol.slice(0, -3) : symbol;
      const name = String(x?.longname || x?.shortname || ticker);
      return { ticker, symbol, name };
    })
    .filter((x) => x.ticker && x.symbol);
}
