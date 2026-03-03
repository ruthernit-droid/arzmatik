import { withRetry, decodeHtmlEntities, stripTags, slugFromUrl } from "./helpers";

export type DiscoveredIpo = {
  slug: string;
  link: string;
  companyName: string;
  ticker: string;
  dateText: string;
  statusText: string;
  ipoPrice?: number;
  totalOfferedLots?: number;
  announcementDate?: string;
  applicationStartDate?: string;
  applicationEndDate?: string;
  demandEndDate?: string;
  demandEndTime?: string;
  allocationDate?: string;
  resultDate?: string;
  listingDate?: string;
};

function parseTurkishDate(input: string): string | undefined {
  const s = String(input || "").trim();
  const m = s.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseTime(input: string): string | undefined {
  const s = String(input || "").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function parsePrice(input: string): number | undefined {
  const s = String(input || "").replace(/\s+/g, "");
  const m = s.match(/(\d[\d.,]*)/);
  if (!m) return undefined;

  let v = m[1];
  if (v.includes(",") && v.includes(".")) {
    // tr locale: 1.234,56
    v = v.replace(/\./g, "").replace(/,/g, ".");
  } else if (v.includes(",")) {
    v = v.replace(/,/g, ".");
  }

  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseLots(input: string): number | undefined {
  const s = String(input || "").trim();
  const m = s.match(/([\d.,]{3,})/);
  if (!m) return undefined;
  const n = Number(m[1].replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function extractFieldValue(html: string, labels: string[]): string {
  const plain = stripTags(html);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // plain text pattern first (works when markup is irregular)
    const plainRe = new RegExp(`${escaped}\\s*[:：]?\\s*([^]{0,120}?)\\s{2,}|${escaped}\\s*[:：]?\\s*([^]{0,120})$`, "i");
    const plainMatch = plain.match(plainRe);
    const plainValue = stripTags((plainMatch?.[1] || plainMatch?.[2] || "").trim());
    if (plainValue) return plainValue;

    // table row label/value pattern
    const rowRe = new RegExp(`${escaped}[\\s\\S]{0,200}?<td[^>]*>([\\s\\S]{0,240}?)<\\/td>`, "i");
    const rowMatch = html.match(rowRe);
    if (rowMatch?.[1]) {
      const value = stripTags(rowMatch[1]);
      if (value) return value;
    }

    // inline label: value pattern
    const inlineRe = new RegExp(`${escaped}\\s*[:：]?\\s*([^<\\n]{2,120})`, "i");
    const inlineMatch = html.match(inlineRe);
    if (inlineMatch?.[1]) {
      const value = stripTags(inlineMatch[1]);
      if (value) return value;
    }
  }
  return "";
}

async function fetchIpoDetail(link: string): Promise<Partial<DiscoveredIpo>> {
  const html = await withRetry(async () => {
    const res = await fetch(link, { headers: { "User-Agent": "halka-arz-matik-bot" } });
    const text = await res.text();
    if (!res.ok || /Just a moment/i.test(text)) {
      const proxy = await fetch(`https://r.jina.ai/http://${link.replace(/^https?:\/\//, "")}`, {
        headers: { "User-Agent": "halka-arz-matik-bot" },
      });
      if (!proxy.ok) throw new Error(`halkarz detail HTTP ${res.status}`);
      return proxy.text();
    }
    return text;
  }, 2);

  const priceText = extractFieldValue(html, ["Halka Arz Fiyat", "Arz Fiyat", "Fiyat"]);
  const lotsText = extractFieldValue(html, ["Toplam Lot", "Arz Miktarı", "Arz Miktari", "Pay Miktarı", "Pay Miktari"]);

  const announceText = extractFieldValue(html, ["Duyuru Tarihi"]);
  const appStartText = extractFieldValue(html, ["Talep Toplama Başlangıç", "Basvuru Baslangic", "Başvuru Başlangıç"]);
  const appEndText = extractFieldValue(html, ["Talep Toplama Bitiş", "Basvuru Bitis", "Başvuru Bitiş"]);
  const demandEndText = extractFieldValue(html, ["Talep Bitiş", "Talep Bitiş", "Talep Toplama Bitiş Saati"]);
  const allocText = extractFieldValue(html, ["Tahsis Tarihi", "Dağıtım Tarihi", "Dagitim Tarihi"]);
  const resultText = extractFieldValue(html, ["Sonuç Tarihi", "Sonuc Tarihi", "Sonuç Açıklama Tarihi"]);
  const listText = extractFieldValue(html, ["Borsa İşlem Tarihi", "Listeleme Tarihi", "Borsada İşlem Görme Tarihi"]);

  const demandDate = parseTurkishDate(demandEndText);
  const demandTime = parseTime(demandEndText);

  return {
    ipoPrice: parsePrice(priceText),
    totalOfferedLots: parseLots(lotsText),
    announcementDate: parseTurkishDate(announceText),
    applicationStartDate: parseTurkishDate(appStartText),
    applicationEndDate: parseTurkishDate(appEndText),
    demandEndDate: demandDate,
    demandEndTime: demandTime,
    allocationDate: parseTurkishDate(allocText),
    resultDate: parseTurkishDate(resultText),
    listingDate: parseTurkishDate(listText),
  };
}

function parseFromMarkdown(md: string, maxItems: number): DiscoveredIpo[] {
  const lines = md.split(/\r?\n/);
  const out: DiscoveredIpo[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    const linkMatch = line.match(/\((https:\/\/halkarz\.com\/[^)\s]+)\s*/i);
    const tickerMatch = line.match(/\b([A-Z0-9]{3,7})\s*$/);
    if (!linkMatch || !tickerMatch) continue;

    const link = decodeHtmlEntities(linkMatch[1]);
    const ticker = tickerMatch[1].toUpperCase();
    const slug = slugFromUrl(link);
    if (!slug || seen.has(slug)) continue;

    let companyName = "";
    let dateText = "";
    let statusText = "";

    const chunk = [lines[i - 1] || "", lines[i] || "", lines[i + 1] || "", lines[i + 2] || "", lines[i + 3] || "", lines[i + 4] || ""].join(" ");
    if (/talep\s*toplan/i.test(chunk)) statusText = "Talep Toplanıyor";
    else if (/basvuru|başvuru/i.test(chunk)) statusText = "Başvuru Açık";
    else statusText = "Duyuru";

    for (let j = i; j < Math.min(i + 8, lines.length); j++) {
      const l = lines[j] || "";
      const titleMatch = l.match(/^###\s*\[([^\]]+)\]/);
      if (titleMatch) {
        companyName = stripTags(titleMatch[1]);
      }
      if (!dateText && /\d{4}/.test(l) && /(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)/i.test(l)) {
        dateText = stripTags(l);
      }
    }

    if (!companyName) {
      const fallbackName = line.match(/\"([^\"]{4,120})\"\)\s*[A-Z0-9]{3,7}\s*$/);
      companyName = stripTags(fallbackName?.[1] || ticker);
    }

    seen.add(slug);
    out.push({ slug, link, companyName, ticker, dateText, statusText });
    if (out.length >= maxItems) break;
  }

  return out;
}

export async function discoverIposFromHalkarz(maxItems = 40): Promise<DiscoveredIpo[]> {
  const html = await withRetry(async () => {
    const res = await fetch("https://halkarz.com/", {
      headers: { "User-Agent": "halka-arz-matik-bot" },
    });
    const text = await res.text();
    if (res.ok && !/Just a moment/i.test(text)) return text;

    const proxy = await fetch("https://r.jina.ai/http://halkarz.com/", {
      headers: { "User-Agent": "halka-arz-matik-bot" },
    });
    if (!proxy.ok) throw new Error(`halkarz HTTP ${res.status}`);
    return proxy.text();
  }, 3);

  // If we received markdown/proxy content, parse with markdown strategy.
  if (/^Title:\s+HalkArz\.com/m.test(html) || /Markdown Content:/m.test(html)) {
    const fromMd = parseFromMarkdown(html, maxItems);
    for (const item of fromMd) {
      try {
        const detail = await fetchIpoDetail(item.link);
        Object.assign(item, detail);
      } catch {
        // best effort only
      }
    }
    return fromMd;
  }

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

    let detail: Partial<DiscoveredIpo> = {};
    try {
      detail = await fetchIpoDetail(link);
    } catch {
      // detail parse is best-effort; list data is still valid
    }

    out.push({ slug, link, companyName, ticker, dateText, statusText, ...detail });
    if (out.length >= maxItems) break;
  }

  return out;
}

function upper(s: string | null | undefined) {
  return (s || "").toUpperCase();
}
