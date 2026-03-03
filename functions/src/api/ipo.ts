import { getFirestore } from "firebase-admin/firestore";
import { cors, getUidFromRequest } from "../utils/helpers";
import { discoverIposFromHalkarz } from "../utils/halkarz";

const db = getFirestore();

type DiscoveredIpo = {
  slug: string;
  link: string;
  companyName: string;
  ticker: string;
  dateText: string;
  statusText: string;
};

async function applyDiscoveredIpos(items: DiscoveredIpo[]) {
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  for (const item of items) {
    const docId = `ipo_ha_${item.slug}`;
    const ref = db.collection("ipos").doc(docId);
    const snap = await ref.get();

    const payload: any = {
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
    } else {
      updated++;
    }

    await ref.set(payload, { merge: true });
  }

  return { created, updated };
}

export async function handleDiscoverHalkarz(req: any, res: any) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  const uid = await getUidFromRequest(req);
  if (!uid) return res.status(401).json({ error: "auth required" });

  const apply = !!req.body?.apply;
  const max = Math.max(1, Math.min(100, Number(req.body?.max || 40)));
  const discovered = await discoverIposFromHalkarz(max);

  if (!apply) {
    return res.json({ source: "halkarz", discovered: discovered.length, data: discovered });
  }

  const result = await applyDiscoveredIpos(discovered);
  return res.json({ source: "halkarz", discovered: discovered.length, ...result });
}
