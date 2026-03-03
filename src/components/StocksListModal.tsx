"use client";

import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, Search, X } from "lucide-react";
import { fetchLatestPriceTwelve } from "@/lib/price-service";
import { updateIpoPrice } from "@/lib/data-service";

function fmtTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString('tr-TR');
}

export default function StocksListModal({
  ipos,
  onClose,
  onAfterUpdate,
}: {
  ipos: any[];
  onClose: () => void;
  onAfterUpdate: () => void;
}) {
  const [q, setQ] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const [quickPrice, setQuickPrice] = useState<number | null>(null);
  const [isQuickPricing, setIsQuickPricing] = useState(false);

  const rows = useMemo(() => {
    const query = q.trim().toUpperCase();
    const base = (ipos || [])
      .filter((i: any) => i?.ticker)
      .map((i: any) => ({
        id: i.id,
        ticker: String(i.ticker || "").toUpperCase(),
        companyName: i.companyName || "",
        status: i.status || "",
        price: Number(i.price || 0),
        priceUpdatedAt: i.priceUpdatedAt,
      }))
      .sort((a: any, b: any) => a.ticker.localeCompare(b.ticker));

    if (!query) return base;
    return base.filter((r: any) => r.ticker.includes(query) || String(r.companyName || "").toUpperCase().includes(query));
  }, [ipos, q]);

  const matches = useMemo(() => {
    const query = q.trim().toUpperCase();
    if (query.length < 2) return [] as any[];

    return rows
      .map((r: any) => {
        const t = String(r.ticker || "").toUpperCase();
        const n = String(r.companyName || "").toUpperCase();
        let s = 0;
        if (t === query) s += 100;
        if (t.startsWith(query)) s += 60;
        if (t.includes(query)) s += 30;
        if (n.includes(query)) s += 10;
        return { ...r, _score: s };
      })
      .filter((x: any) => x._score > 0)
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 12);
  }, [q, rows]);

  const looksLikeTicker = useMemo(() => {
    const t = q.trim().toUpperCase();
    return /^[A-Z]{3,7}$/.test(t) ? t : "";
  }, [q]);

  useEffect(() => {
    if (!looksLikeTicker) {
      setQuickPrice(null);
      return;
    }
    let alive = true;
    setIsQuickPricing(true);
    const tm = setTimeout(async () => {
      try {
        const p = await fetchLatestPriceTwelve(looksLikeTicker);
        if (!alive) return;
        setQuickPrice(p || null);
      } catch {
        if (!alive) return;
        setQuickPrice(null);
      } finally {
        if (alive) setIsQuickPricing(false);
      }
    }, 700);
    return () => {
      alive = false;
      clearTimeout(tm);
    };
  }, [looksLikeTicker]);

  const updateOne = async (id: string, ticker: string) => {
    setIsUpdating(true);
    try {
      const p = await fetchLatestPriceTwelve(ticker);
      if (!p) {
        alert(`${ticker}: fiyat cekilemedi.`);
        return;
      }
      await updateIpoPrice(id, p);
      onAfterUpdate();
    } catch (e) {
      console.error(e);
      alert(`${ticker}: fiyat cekilemedi.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateAllVisible = async () => {
    if (rows.length === 0) return;
    if (!confirm(`Gorunen ${rows.length} hisse icin fiyat guncellensin mi?`)) return;

    setIsUpdating(true);
    setProgress({ done: 0, total: rows.length });
    try {
      let done = 0;
      for (const r of rows) {
        try {
          const p = await fetchLatestPriceTwelve(r.ticker);
          if (p) {
            await updateIpoPrice(r.id, p);
          }
        } catch (e) {
          // keep going
          console.error(e);
        } finally {
          done++;
          setProgress({ done, total: rows.length });
          // tiny delay so we don't hammer the proxy
          await new Promise(res => setTimeout(res, 250));
        }
      }
      onAfterUpdate();
    } finally {
      setIsUpdating(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ scale: 0.98, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 10 }}
        className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
          <div>
            <h2 className="text-lg font-black text-white">Hisse Listesi</h2>
            <p className="text-xs text-zinc-500 font-bold">Gecikmeli veriyi sadece sen tetikleyince guncelliyoruz.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-emerald-500 transition-all font-bold"
                placeholder="Ara (ticker veya sirket)"
              />
            </div>

            <button
              onClick={updateAllVisible}
              disabled={isUpdating}
              className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${isUpdating ? 'opacity-50 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}
            >
              <RefreshCcw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              Goruneni Guncelle
            </button>
          </div>

          {matches.length > 0 && (
            <div className="mb-4 p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Eslesmeler</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {matches.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => setQ(m.ticker)}
                    className="text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/30 transition-all"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white truncate">{m.ticker}</div>
                      <div className="text-[10px] font-bold text-zinc-500 truncate">{m.companyName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-400">{Number(m.price || 0).toLocaleString('tr-TR')} TL</div>
                      <div className="text-[10px] font-bold text-zinc-500">{fmtTime(m.priceUpdatedAt)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {looksLikeTicker && (
            <div className="mb-4 p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20">
              <div className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Hizli Fiyat: {looksLikeTicker}
                <span className="ml-3 text-zinc-400 font-bold normal-case">
                  {isQuickPricing ? "cekiliyor..." : quickPrice ? `${quickPrice.toLocaleString('tr-TR')} TL` : "-"}
                </span>
              </div>
            </div>
          )}

          {null}

          {progress && (
            <div className="mb-4 text-xs font-black uppercase tracking-widest text-zinc-500">
              Guncelleniyor: {progress.done}/{progress.total}
            </div>
          )}

          <div className="max-h-[60vh] overflow-auto rounded-2xl border border-zinc-900">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur border-b border-zinc-900">
                <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-4">Ticker</th>
                  <th className="p-4">Durum</th>
                  <th className="p-4">Fiyat</th>
                  <th className="p-4">Son Guncelleme</th>
                  <th className="p-4 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="p-4 text-sm font-black text-white">{r.ticker}</td>
                    <td className="p-4 text-xs font-black text-zinc-400">{r.status || '-'}</td>
                    <td className="p-4 text-sm font-black text-emerald-400">{Number(r.price || 0).toLocaleString('tr-TR')} TL</td>
                    <td className="p-4 text-xs font-bold text-zinc-500">{fmtTime(r.priceUpdatedAt)}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => updateOne(r.id, r.ticker)}
                        disabled={isUpdating}
                        className="px-3 py-2 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Guncelle
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-zinc-500 font-bold">
                      Kayit bulunamadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
