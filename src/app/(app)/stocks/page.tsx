"use client";

import React, { useMemo, useState } from "react";
import { RefreshCcw, Search, Pencil, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { fetchLatestPriceTwelve } from "@/lib/price-service";
import { updateIpoPrice, addHoldingToAccount } from "@/lib/data-service";
import StockModal from "@/components/StockModal";

function fmtTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR");
}

export default function StocksPage() {
  const { ipos, accounts, user, refreshData } = useFirebaseDataContext();
  const [q, setQ] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [editingStock, setEditingStock] = useState<any | null>(null);
  
  // Add to portfolio state
  const [addingStock, setAddingStock] = useState<any | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [buyLots, setBuyLots] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const rows = useMemo(() => {
    const query = q.trim().toUpperCase();
    const base = (ipos || [])
      .filter((i: any) => String(i.status || "") === "Borsada İşlem Görüyor" || String(i.status || "") === "listeleme" || String(i.source || "") === "twelvedata")
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

  // Add to portfolio functions
  const openAddToPortfolio = (stock: any) => {
    setAddingStock(stock);
    setSelectedAccounts([]);
    setBuyLots(0);
  };

  const toggleAccount = (accId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    );
  };

  const handleAddToPortfolio = async () => {
    if (!user || !addingStock || buyLots <= 0 || selectedAccounts.length === 0) {
      alert("Lütfen lot ve en az bir hesap seçin!");
      return;
    }

    setIsSaving(true);
    try {
      for (const accId of selectedAccounts) {
        await addHoldingToAccount(
          user.uid,
          accId,
          addingStock.ticker,
          buyLots,
          'portfolio',
          addingStock.price,
          true
        );
      }
      await refreshData();
      setAddingStock(null);
      alert("Portföye eklendi!");
    } catch (e) {
      console.error(e);
      alert("Hata oluştu!");
    } finally {
      setIsSaving(false);
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
              <p className="text-lg font-bold text-emerald-400">{Number(r.price || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</p>
            </div>
            
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
              <span>Güncellenme: {fmtTime(r.priceUpdatedAt)}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openAddToPortfolio(r)}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white"
              >
                <Plus className="w-3 h-3 inline mr-1" /> Portföye Ekle
              </button>
              <button
                onClick={() => setEditingStock(r)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-400"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateOne(r.id, r.ticker)}
                disabled={isUpdating}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white"
              >
                <RefreshCcw className={`w-3 h-3 ${isUpdating ? "animate-spin" : ""}`} />
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

      {/* Add to Portfolio Modal */}
      <AnimatePresence>
        {addingStock && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddingStock(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-900 bg-zinc-900/50">
                <h2 className="text-xl font-bold text-white">Portföye Ekle</h2>
                <p className="text-sm text-zinc-500">{addingStock.ticker} - {Number(addingStock.price || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-zinc-500">Lot</label>
                  <input
                    type="number"
                    value={buyLots || ""}
                    onChange={(e) => setBuyLots(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-black uppercase text-zinc-500">Hesaplar</label>
                    <button 
                      onClick={() => setSelectedAccounts(accounts?.map((a: any) => a.id) || [])}
                      className="text-xs text-emerald-400 font-bold"
                    >
                      Tümünü Seç
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                    {accounts?.map((acc: any) => (
                      <div
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between ${
                          selectedAccounts.includes(acc.id)
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : "bg-zinc-900 border-zinc-800"
                        }`}
                      >
                        <span className="font-bold text-sm">{acc.ownerName || acc.name}</span>
                        <span className="text-xs text-zinc-500">{acc.bankName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/50 p-3 rounded-xl">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Toplam</span>
                    <span className="font-black text-emerald-400">{(buyLots * addingStock.price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-900 bg-zinc-900/30 flex gap-3">
                <button
                  onClick={() => setAddingStock(null)}
                  className="flex-1 py-3 text-zinc-400 font-bold"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddToPortfolio}
                  disabled={isSaving || buyLots <= 0 || selectedAccounts.length === 0}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-bold text-white"
                >
                  {isSaving ? "Kaydediliyor..." : "Ekle"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
