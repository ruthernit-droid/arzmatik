"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, X, TrendingDown } from "lucide-react";

type Holding = {
  ipoId?: string;
  ticker: string;
  totalLots: number;
  totalCost?: number;
};

export default function SellSelectorModal({
  holdings,
  ipos,
  onClose,
  onSelect,
}: {
  holdings: Holding[];
  ipos: any[];
  onClose: () => void;
  onSelect: (h: Holding) => void;
}) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const query = q.trim().toUpperCase();
    const base = (holdings || [])
      .filter((h) => (h.totalLots || 0) > 0)
      .map((h) => {
        const ipo = ipos.find((i: any) => i.id === h.ipoId) || ipos.find((i: any) => String(i.ticker || "").toUpperCase() === String(h.ticker || "").toUpperCase());
        const price = Number(ipo?.price || 0);
        const value = Number(h.totalLots || 0) * price;
        return { ...h, price, value };
      })
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

    if (!query) return base;
    return base.filter((h: any) => String(h.ticker || "").toUpperCase().includes(query));
  }, [q, holdings, ipos]);

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
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
        className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20">
              <TrendingDown className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Toplu Satis - Hisse Sec</h2>
              <p className="text-xs text-zinc-500 font-bold">Portfoyundeki hisselerden birini sec.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-rose-500 transition-all font-bold"
              placeholder="Ticker ara (ORNEK: THYAO)"
            />
          </div>

          <div className="max-h-[55vh] overflow-auto rounded-2xl border border-zinc-900">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur border-b border-zinc-900">
                <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-4">Hisse</th>
                  <th className="p-4">Lot</th>
                  <th className="p-4">Fiyat</th>
                  <th className="p-4">Deger</th>
                  <th className="p-4 text-right">Sec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {rows.map((h: any) => (
                  <tr key={h.ipoId || h.ticker} className="hover:bg-zinc-900/30 transition-all">
                    <td className="p-4 text-sm font-black text-white">{h.ticker}</td>
                    <td className="p-4 text-sm font-bold text-zinc-400">{h.totalLots} Lot</td>
                    <td className="p-4 text-sm font-bold text-zinc-400">{Number(h.price || 0).toLocaleString('tr-TR')} TL</td>
                    <td className="p-4 text-sm font-black text-emerald-400">{Number(h.value || 0).toLocaleString('tr-TR')} TL</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onSelect(h)}
                        className="px-4 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black transition-all"
                      >
                        SEC
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500 font-bold">
                      Hisse bulunamadi.
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
