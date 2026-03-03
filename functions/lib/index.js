"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncXistStocks = exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const stocks_1 = require("./api/stocks");
const ipo_1 = require("./api/ipo");
const twelvedata_1 = require("./utils/twelvedata");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const TWELVEDATA_API_KEY = (0, params_1.defineSecret)("TWELVEDATA_API_KEY");
exports.api = (0, https_1.onRequest)({
    region: "europe-west1",
    secrets: [TWELVEDATA_API_KEY],
    timeoutSeconds: 120,
    memory: "512MiB",
}, async (req, res) => {
    const rawPath = req.path || "/";
    const path = rawPath.startsWith("/api/") ? rawPath.slice(4) : rawPath;
    try {
        if (req.method === "GET" && path === "/twelve/stocks") {
            return (0, stocks_1.handleStocks)(req, res);
        }
        if (req.method === "GET" && path === "/twelve/quote") {
            return (0, stocks_1.handleQuote)(req, res);
        }
        if (req.method === "POST" && path === "/twelve/import") {
            return (0, stocks_1.handleImport)(req, res);
        }
        if (req.method === "POST" && path === "/twelve/import_all") {
            return (0, stocks_1.handleImportAll)(req, res);
        }
        if (req.method === "POST" && path === "/ipo/discover_halkarz") {
            return (0, ipo_1.handleDiscoverHalkarz)(req, res);
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
exports.syncXistStocks = (0, scheduler_1.onSchedule)({
    region: "europe-west1",
    secrets: [TWELVEDATA_API_KEY],
    schedule: "every 60 minutes",
    timeoutSeconds: 300,
    memory: "512MiB",
}, async () => {
    const apiKey = TWELVEDATA_API_KEY.value();
    const exchange = twelvedata_1.TD_EXCHANGE_DEFAULT;
    const list = await (0, twelvedata_1.tdListStocks)(exchange, apiKey);
    await (0, stocks_1.writeIposFromStocksList)(list, exchange);
});
