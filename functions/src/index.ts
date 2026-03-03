import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { handleStocks, handleQuote, handleImport, handleImportAll, writeIposFromStocksList } from "./api/stocks";
import { handleDiscoverHalkarz } from "./api/ipo";
import { tdListStocks, TD_EXCHANGE_DEFAULT } from "./utils/twelvedata";

initializeApp();
const db = getFirestore();

const TWELVEDATA_API_KEY = defineSecret("TWELVEDATA_API_KEY");

export const api = onRequest(
  {
    region: "europe-west1",
    secrets: [TWELVEDATA_API_KEY],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req: any, res: any) => {
    const rawPath = req.path || "/";
    const path = rawPath.startsWith("/api/") ? rawPath.slice(4) : rawPath;

    try {
      if (req.method === "GET" && path === "/twelve/stocks") {
        return handleStocks(req, res);
      }

      if (req.method === "GET" && path === "/twelve/quote") {
        return handleQuote(req, res);
      }

      if (req.method === "POST" && path === "/twelve/import") {
        return handleImport(req, res);
      }

      if (req.method === "POST" && path === "/twelve/import_all") {
        return handleImportAll(req, res);
      }

      if (req.method === "POST" && path === "/ipo/discover_halkarz") {
        return handleDiscoverHalkarz(req, res);
      }

      return res.status(404).json({ error: "not found", path, method: req.method });
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || e);
      const status = msg.includes("Rate limit exceeded") ? 429 : 500;
      return res.status(status).json({ error: msg });
    }
  }
);

export const syncXistStocks = onSchedule(
  {
    region: "europe-west1",
    secrets: [TWELVEDATA_API_KEY],
    schedule: "every 60 minutes",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    const apiKey = TWELVEDATA_API_KEY.value();
    const exchange = TD_EXCHANGE_DEFAULT;
    const list = await tdListStocks(exchange, apiKey);
    await writeIposFromStocksList(list, exchange);
  }
);
