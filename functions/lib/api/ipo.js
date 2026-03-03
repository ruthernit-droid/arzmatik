"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDiscoverHalkarz = handleDiscoverHalkarz;
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const helpers_1 = require("../utils/helpers");
const halkarz_1 = require("../utils/halkarz");
const params_1 = require("firebase-functions/params");
const twelvedata_1 = require("../utils/twelvedata");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const TWELVEDATA_API_KEY = (0, params_1.defineSecret)("TWELVEDATA_API_KEY");
function normalizeText(input) {
    return String(input || "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "")
        .trim();
}
function normalizeTicker(input) {
    return String(input || "")
        .toUpperCase()
        .replace(/\.IS$/i, "")
        .replace(/[^A-Z0-9]/g, "")
        .trim();
}
function isMeaningful(value) {
    if (value === null || value === undefined)
        return false;
    if (typeof value === "string")
        return value.trim() !== "";
    if (typeof value === "number")
        return Number.isFinite(value) && value > 0;
    return true;
}
function mapStatus(statusText) {
    const t = normalizeText(statusText);
    if (!t)
        return "duyuru";
    if (t.includes("talep") && (t.includes("topla") || t.includes("acik") || t.includes("ac")))
        return "talep_toplaniyor";
    if (t.includes("talep") && t.includes("kapan"))
        return "talep_kapandi";
    if (t.includes("tahsis"))
        return "tahsis";
    if (t.includes("sonuc"))
        return "sonuclar";
    if (t.includes("liste") || t.includes("borsa"))
        return "listeleme";
    return "duyuru";
}
function parseDateParts(dateText) {
    const t = String(dateText || "");
    const isoMatches = t.match(/(\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4})/g) || [];
    const toIso = (raw) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw))
            return raw;
        const m = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
        if (!m)
            return "";
        return `${m[3]}-${m[2]}-${m[1]}`;
    };
    const normalized = isoMatches.map(toIso).filter(Boolean);
    if (normalized.length >= 2) {
        return {
            applicationStartDate: normalized[0],
            applicationEndDate: normalized[normalized.length - 1],
            demandEndDate: normalized[normalized.length - 1],
        };
    }
    if (normalized.length === 1) {
        return {
            applicationStartDate: normalized[0],
            applicationEndDate: normalized[0],
            demandEndDate: normalized[0],
        };
    }
    // Turkish textual format: 2-3-4 Mart 2026
    const monthMap = {
        ocak: "01",
        subat: "02",
        şubat: "02",
        mart: "03",
        nisan: "04",
        mayis: "05",
        mayıs: "05",
        haziran: "06",
        temmuz: "07",
        agustos: "08",
        ağustos: "08",
        eylul: "09",
        eylül: "09",
        ekim: "10",
        kasim: "11",
        kasım: "11",
        aralik: "12",
        aralık: "12",
    };
    const txt = t.toLocaleLowerCase("tr-TR");
    const m = txt.match(/(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?(?:\s*[-–]\s*(\d{1,2}))?\s+([a-zçğıöşü]+)\s+(\d{4})/i);
    if (m) {
        const days = [m[1], m[2], m[3]].filter(Boolean).map((x) => String(Number(x)).padStart(2, "0"));
        const mm = monthMap[m[4]];
        const yyyy = m[5];
        if (mm && days.length > 0) {
            const start = `${yyyy}-${mm}-${days[0]}`;
            const end = `${yyyy}-${mm}-${days[days.length - 1]}`;
            return {
                applicationStartDate: start,
                applicationEndDate: end,
                demandEndDate: end,
            };
        }
    }
    return {};
}
async function applyDiscoveredIpos(items) {
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let withPrice = 0;
    let withDates = 0;
    const allSnap = await db.collection("ipos").get();
    const byTicker = new Map();
    const byNameKey = new Map();
    const bySourceLink = new Map();
    for (const d of allSnap.docs) {
        const data = d.data();
        const ticker = normalizeTicker(String(data?.ticker || data?.symbol || ""));
        const nameKey = normalizeText(String(data?.companyName || data?.name || ""));
        const sourceLink = String(data?.sourceLink || "");
        if (ticker)
            byTicker.set(ticker, d.id);
        if (nameKey)
            byNameKey.set(nameKey, d.id);
        if (sourceLink)
            bySourceLink.set(sourceLink, d.id);
    }
    for (const item of items) {
        const tickerKey = normalizeTicker(String(item.ticker || ""));
        const nameKey = normalizeText(item.companyName);
        const defaultDocId = `ipo_ha_${item.slug}`;
        const foundId = bySourceLink.get(item.link) || byTicker.get(tickerKey) || byNameKey.get(nameKey) || defaultDocId;
        const ref = db.collection("ipos").doc(foundId);
        const snap = await ref.get();
        const parsedDates = parseDateParts(item.dateText);
        let detectedPrice = isMeaningful(item.ipoPrice) ? Number(item.ipoPrice) : undefined;
        if (!detectedPrice && tickerKey) {
            try {
                const apiKey = TWELVEDATA_API_KEY.value();
                const q = await (0, twelvedata_1.tdQuote)(tickerKey, apiKey);
                const p = Number(q?.close ?? q?.price);
                if (Number.isFinite(p) && p > 0)
                    detectedPrice = p;
            }
            catch {
                // best effort
            }
        }
        const newData = {
            companyName: item.companyName,
            ticker: item.ticker,
            ipoDateText: item.dateText,
            status: mapStatus(item.statusText),
            ...(isMeaningful(detectedPrice) ? { price: Number(detectedPrice), ipoPrice: Number(detectedPrice) } : {}),
            ...(isMeaningful(item.totalOfferedLots) ? { totalOfferedLots: Number(item.totalOfferedLots) } : {}),
            ...(isMeaningful(item.announcementDate) ? { announcementDate: item.announcementDate } : {}),
            ...(isMeaningful(item.applicationStartDate || parsedDates.applicationStartDate) ? { applicationStartDate: item.applicationStartDate || parsedDates.applicationStartDate } : {}),
            ...(isMeaningful(item.applicationEndDate || parsedDates.applicationEndDate) ? { applicationEndDate: item.applicationEndDate || parsedDates.applicationEndDate } : {}),
            ...(isMeaningful(item.demandEndDate || parsedDates.demandEndDate) ? { demandEndDate: item.demandEndDate || parsedDates.demandEndDate } : {}),
            ...(isMeaningful(item.demandEndTime) ? { demandEndTime: item.demandEndTime } : {}),
            ...(isMeaningful(item.allocationDate) ? { allocationDate: item.allocationDate } : {}),
            ...(isMeaningful(item.resultDate) ? { resultDate: item.resultDate } : {}),
            ...(isMeaningful(item.listingDate) ? { listingDate: item.listingDate } : {}),
            source: "halkarz",
            sourceLink: item.link,
            sourceStatusText: item.statusText,
            companyNameKey: nameKey,
            tickerKey,
            isIpo: true,
            updatedAt: now,
        };
        if (isMeaningful(detectedPrice))
            withPrice++;
        if (isMeaningful(newData.announcementDate) ||
            isMeaningful(newData.applicationStartDate) ||
            isMeaningful(newData.applicationEndDate) ||
            isMeaningful(newData.demandEndDate) ||
            isMeaningful(newData.allocationDate) ||
            isMeaningful(newData.resultDate) ||
            isMeaningful(newData.listingDate)) {
            withDates++;
        }
        if (!snap.exists) {
            // For brand new records we can initialize workflow fields from scan.
            if (!newData.status)
                newData.status = "duyuru";
            if (!newData.demandEndTime)
                newData.demandEndTime = "17:00";
            newData.createdAt = now;
            await ref.set(newData);
            created++;
            byTicker.set(tickerKey, ref.id);
            if (nameKey)
                byNameKey.set(nameKey, ref.id);
            bySourceLink.set(item.link, ref.id);
        }
        else {
            const existingData = snap.data() || {};
            const updateData = { updatedAt: now };
            const protectedFields = new Set([
                "status",
                "announcementDate",
                "applicationStartDate",
                "applicationEndDate",
                "demandEndDate",
                "demandEndTime",
                "allocationDate",
                "resultDate",
                "listingDate",
            ]);
            const neverOverrideIfPresent = new Set([
                "companyName",
                "ticker",
                "price",
                "ipoPrice",
                "totalOfferedLots",
            ]);
            for (const [key, value] of Object.entries(newData)) {
                const existingValue = existingData[key];
                const isEmpty = existingValue === null || existingValue === undefined || existingValue === "";
                // Never reset user-managed lifecycle fields once set.
                if (protectedFields.has(key) && !isEmpty) {
                    continue;
                }
                // Also avoid clobbering manual core values once user set them.
                if (neverOverrideIfPresent.has(key) && !isEmpty) {
                    continue;
                }
                if (isEmpty && isMeaningful(value)) {
                    updateData[key] = value;
                }
            }
            if (Object.keys(updateData).length > 1) {
                await ref.set(updateData, { merge: true });
                updated++;
            }
            else {
                updated++;
            }
            byTicker.set(tickerKey, ref.id);
            if (nameKey)
                byNameKey.set(nameKey, ref.id);
            bySourceLink.set(item.link, ref.id);
        }
    }
    return { created, updated, withPrice, withDates };
}
async function handleDiscoverHalkarz(req, res) {
    (0, helpers_1.cors)(res);
    if (req.method === "OPTIONS")
        return res.status(204).send("");
    const uid = await (0, helpers_1.getUidFromRequest)(req);
    if (!uid)
        return res.status(401).json({ error: "auth required" });
    const apply = !!req.body?.apply;
    const max = Math.max(1, Math.min(100, Number(req.body?.max || 40)));
    const discovered = await (0, halkarz_1.discoverIposFromHalkarz)(max);
    if (!apply) {
        return res.json({ source: "halkarz", discovered: discovered.length, data: discovered });
    }
    const result = await applyDiscoveredIpos(discovered);
    return res.json({ source: "halkarz", discovered: discovered.length, ...result });
}
