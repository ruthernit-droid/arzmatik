"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.asNum = asNum;
exports.upper = upper;
exports.toBistSymbol = toBistSymbol;
exports.dayKey = dayKey;
exports.sleep = sleep;
exports.withRetry = withRetry;
exports.decodeHtmlEntities = decodeHtmlEntities;
exports.stripTags = stripTags;
exports.slugFromUrl = slugFromUrl;
exports.cors = cors;
exports.getUidFromRequest = getUidFromRequest;
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
function asNum(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
}
function upper(x) {
    return String(x || "").trim().toUpperCase();
}
function toBistSymbol(ticker) {
    const t = upper(ticker);
    if (!t)
        return "";
    return t.replace(/\.IS$/i, "");
}
function dayKey(d = new Date()) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
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
            const wait = msg.includes("429") ? 1200 : 400 * (i + 1);
            await sleep(wait);
        }
    }
    throw lastErr;
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
function cors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
async function getUidFromRequest(req) {
    const hdr = String(req.get("Authorization") || "");
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m)
        return null;
    const token = m[1];
    try {
        const { getAuth } = await Promise.resolve().then(() => __importStar(require("firebase-admin/auth")));
        const decoded = await getAuth().verifyIdToken(token);
        return decoded.uid;
    }
    catch {
        return null;
    }
}
async function cacheGet(key) {
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require("firebase-admin/firestore")));
    const db = getFirestore();
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
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require("firebase-admin/firestore")));
    const db = getFirestore();
    const ref = db.collection("api_cache").doc(key);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await ref.set({
        value,
        expiresAt,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
}
