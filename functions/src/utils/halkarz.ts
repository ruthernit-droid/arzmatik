import { withRetry, decodeHtmlEntities, stripTags, slugFromUrl } from "./helpers";

export type DiscoveredIpo = {
  slug: string;
  link: string;
  companyName: string;
  ticker: string;
  dateText: string;
  statusText: string;
};

export async function discoverIposFromHalkarz(maxItems = 40): Promise<DiscoveredIpo[]> {
  const html = await withRetry(async () => {
    const res = await fetch("https://halkarz.com/", {
      headers: { "User-Agent": "halka-arz-matik-bot" },
    });
    if (!res.ok) throw new Error(`halkarz HTTP ${res.status}`);
    return res.text();
  }, 3);

  const listStart = html.indexOf('<ul class="halka-arz-list">');
  if (listStart < 0) return [];
  const listEnd = html.indexOf("<div class=\"misha_loadmore\"", listStart);
  const section = listEnd > listStart ? html.slice(listStart, listEnd) : html.slice(listStart);

  const blocks = section.match(/<article class="index-list">[\s\S]*?<\/article>/g) || [];
  const out: DiscoveredIpo[] = [];

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

    if (!link || !slug || !ticker) continue;

    out.push({ slug, link, companyName, ticker, dateText, statusText });
    if (out.length >= maxItems) break;
  }

  return out;
}

function upper(s: string | null | undefined) {
  return (s || "").toUpperCase();
}
