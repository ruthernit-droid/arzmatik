export function asNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export function upper(x: any) {
  return String(x || "").trim().toUpperCase();
}

export function toBistSymbol(ticker: string) {
  const t = upper(ticker);
  if (!t) return "";
  return t.replace(/\.IS$/i, "");
}

export function dayKey(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      const wait = msg.includes("429") ? 1200 : 400 * (i + 1);
      await sleep(wait);
    }
  }
  throw lastErr;
}

export function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function stripTags(input: string) {
  return decodeHtmlEntities(String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

export function slugFromUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  } catch {
    return "";
  }
}

export function cors(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

export async function getUidFromRequest(req: any): Promise<string | null> {
  const hdr = String(req.get("Authorization") || "");
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1];
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const { getFirestore } = await import("firebase-admin/firestore");
  const db = getFirestore();
  const ref = db.collection("api_cache").doc(key);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  const exp = data?.expiresAt;
  if (typeof exp === "string") {
    const t = new Date(exp).getTime();
    if (!Number.isFinite(t) || Date.now() > t) return null;
  }
  return (data?.value as T) ?? null;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number) {
  const { getFirestore } = await import("firebase-admin/firestore");
  const db = getFirestore();
  const ref = db.collection("api_cache").doc(key);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await ref.set({
    value,
    expiresAt,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
