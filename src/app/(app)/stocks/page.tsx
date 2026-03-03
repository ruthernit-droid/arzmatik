"use client";

import React, { useMemo, useState } from "react";
import { RefreshCcw, Search, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { fetchLatestPriceTwelve } from "@/lib/price-service";
import { updateIpoPrice } from "@/lib/data-service";
import StockModal from "@/components/StockModal";

function fmtTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR");
}

export default function StocksPage() {
  const { ipos, refreshData } = useFirebaseDataContext();
  const [q, setQ] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [editingStock, setEditingStock] = useState<any | null>(null);

  const rows = useMemo(() => {
    const query = q.trim().toUpperCase();
    const base = (ipos || [])
      .filter((i: any) => String(i.status || "") === "Borsada İşlem Görüyor" || String(i.source || "") === "twelvedata")
      .map((i: any) => ({
        id: i.id,
        ticker: String(i.ticker || "").toUpperCase(),
        companyName: i.companyName || "",
        price: Number(i.price || 0),
        priceUpdatedAt: i.priceUpdatedAt,
      }))
      .sort((a: any, b: any) => a.ticker.localeCompare(b.ticker));

    if (!query) return base;
    return base.filter((r: any) => r.ticker.includes(query) || String(r.companyName || "").toUpperCase().includes(query));
  }, [ipos, q]);

  const updateOne = async (id: string, ticker: string) => {
    setIsUpdating(true);
    try {
      const p = await fetchLatestPriceTwelve(ticker);
      if (!p) return;
      await updateIpoPrice(id, p);
      await refreshData();
    } finally {
      setIsUpdating(false);
    }
  };

  const updateAllVisible = async () => {
    if (rows.length === 0) return;
    setIsUpdating(true);
    setProgress({ done: 0, total: rows.length });
    try {
      let done = 0;
      for (const r of rows) {
        try {
          const p = await fetchLatestPriceTwelve(r.ticker);
          if (p) await updateIpoPrice(r.id, p);
        } finally {
          done++;
          setProgress({ done, total: rows.length });
        }
      }
      await refreshData();
    } finally {
      setIsUpdating(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">Tüm Hisseler</h1>
          <p className="text-xs text-zinc-500 font-bold">{rows.length} hisse</p>
        </div>
        <button
          onClick={updateAllVisible}
          disabled={isUpdating}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${isUpdating ? "opacity-50 bg-zinc-800 text-zinc-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}
        >
          <RefreshCcw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
          Tümünü Güncelle
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-emerald-500 font-bold"
          placeholder="Hisse ara..."
        />
      </div>

      {progress && <div className="text-xs font-bold text-zinc-500">Güncelleniyor: {progress.done}/{progress.total}</div>}

      {/* Stock Cards - Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r: any) => (
          <div key={r.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-lg">{r.ticker}</p>
                <p className="text-xs text-zinc-500 truncate max-w-[150px]">{r.companyName}</p>
              </div>
              <p className="text-lg font-bold text-emerald-400">{Number(r.price || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
            </div>
            
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
              <span>Güncellenme: {fmtTime(r.priceUpdatedAt)}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditingStock(r)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-400"
              >
                Düzenle
              </button>
              <button
                onClick={() => updateOne(r.id, r.ticker)}
                disabled={isUpdating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white"
              >
                Fiyat Güncelle
              </button>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="text-center py-10 text-zinc-500">
          <p className="font-medium">Hisse bulunamadı</p>
        </div>
      )}

      <AnimatePresence>
        {editingStock && (
          <StockModal
            stock={editingStock}
            onClose={() => setEditingStock(null)}
            onSave={refreshData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
