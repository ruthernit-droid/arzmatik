"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, RefreshCcw, X } from "lucide-react";
import { bulkAddHoldingToAccounts, saveIPO, updateIpoPrice } from "@/lib/data-service";
import { fetchLatestPriceTwelve } from "@/lib/price-service";

export default function BulkBuyModal({
  userId,
  accounts,
  ipos,
  onClose,
  onSaved,
}: {
  userId: string;
  accounts: any[];
  ipos: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ticker, setTicker] = useState("");
  const [purchaseType, setPurchaseType] = useState<'ipo' | 'portfolio'>('portfolio');
  const [lotPrice, setLotPrice] = useState<number>(0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [adjustCash, setAdjustCash] = useState(true);

  const [mode, setMode] = useState<'uniform' | 'perAccount'>('uniform');
  const [uniformLots, setUniformLots] = useState<number>(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(accounts.filter((a: any) => a.isActive).map((a: any) => a.id))
  );
  const [perAccountLots, setPerAccountLots] = useState<Record<string, number>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const autoReqId = useRef(0);

  const stockMatches = useMemo(() => {
    const query = ticker.trim().toUpperCase();
    if (query.length < 2) return [] as any[];
    return (ipos || [])
      .filter((i: any) => i?.ticker)
      .map((i: any) => {
        const t = String(i.ticker || "").toUpperCase();
        const n = String(i.companyName || "").toUpperCase();
        let s = 0;
        if (t === query) s += 100;
        if (t.startsWith(query)) s += 60;
        if (t.includes(query)) s += 30;
        if (n.includes(query)) s += 10;
        return { id: i.id, ticker: t, companyName: i.companyName || t, price: Number(i.price || 0), _score: s };
      })
      .filter((x: any) => x._score > 0)
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 8);
  }, [ipos, ticker]);

  const rows = useMemo(() => {
    return (accounts || []).map((a: any) => {
      const lots = mode === 'uniform' ? uniformLots : Number(perAccountLots[a.id] || 0);
      const selected = selectedIds.has(a.id);
      return { ...a, _selected: selected, _lots: lots };
    });
  }, [accounts, mode, uniformLots, perAccountLots, selectedIds]);

  const totalLots = useMemo(() => {
    return rows.reduce((sum: number, r: any) => sum + (r._selected ? Number(r._lots || 0) : 0), 0);
  }, [rows]);

  const totalCost = useMemo(() => totalLots * Number(lotPrice || 0), [totalLots, lotPrice]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAll = (value: boolean) => {
    if (!value) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(accounts.map((a: any) => a.id)));
  };

  const fetchPrice = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) {
      alert("Once ticker gir!");
      return;
    }
    setIsFetchingPrice(true);
    try {
      const p = await fetchLatestPriceTwelve(t);
      if (!p) {
        alert("Fiyat cekilemedi.");
        return;
      }
      setLotPrice(p);
    } catch (e) {
      console.error(e);
      alert("Fiyat cekilemedi.");
    } finally {
      setIsFetchingPrice(false);
    }
  };

  useEffect(() => {
    const t = ticker.trim().toUpperCase();
    if (t.length < 3) return;
    const id = ++autoReqId.current;
    const tm = setTimeout(async () => {
      if (priceTouched && lotPrice > 0) return;
      try {
        const p = await fetchLatestPriceTwelve(t);
        if (autoReqId.current !== id) return;
        if (p && (!priceTouched && (!lotPrice || lotPrice <= 0))) {
          setLotPrice(p);
        }
      } catch {
        // ignore
      }
    }, 700);

    return () => clearTimeout(tm);
  }, [ticker, lotPrice, priceTouched]);

  const handleSave = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) {
      alert("Lutfen ticker girin!");
      return;
    }
    if (!lotPrice || lotPrice <= 0) {
      alert("Lutfen gecerli bir fiyat girin!");
      return;
    }
    if (purchaseType !== 'ipo' && purchaseType !== 'portfolio') {
      alert("Lutfen alim turunu secin (H/P)!");
      return;
    }

    const chosen = rows
      .filter((r: any) => r._selected)
      .map((r: any) => ({ accountId: r.id, lots: Number(r._lots || 0) }))
      .filter((x: any) => x.lots > 0);

    if (chosen.length === 0) {
      alert("Secili hesaplarda lot 0 olamaz!");
      return;
    }

    setIsSaving(true);
    try {
      const existing = ipos.find((i: any) => String(i.ticker || "").toUpperCase() === t);
      let ipoId = existing?.id as string | undefined;

      if (!ipoId) {
        ipoId = await saveIPO({
          companyName: t,
          ticker: t,
          price: lotPrice,
          status: "Borsada İşlem Görüyor",
        });
      } else {
        await updateIpoPrice(ipoId, lotPrice);
      }

      await bulkAddHoldingToAccounts(userId, ipoId, chosen, purchaseType, lotPrice, adjustCash);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Toplu alim sirasinda hata olustu!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] overflow-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="relative min-h-full flex justify-center items-start p-4 md:p-8">
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 10 }}
          className="relative w-full max-w-6xl max-h-[90vh] bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col"
        >
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
          <div>
            <h2 className="text-lg font-black text-white">Toplu Hisse Alimi</h2>
            <p className="text-xs text-zinc-500 font-bold">Tek ticker ile birden fazla hesaba lot ekle.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Ticker</label>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all font-mono font-bold"
                placeholder="ORNEK: THYAO"
              />
              {stockMatches.length > 0 && (
                <div className="mt-2 rounded-2xl border border-zinc-900 bg-zinc-950 overflow-hidden">
                  {stockMatches.map((m: any) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setTicker(m.ticker);
                        if (!priceTouched && (!lotPrice || lotPrice <= 0) && m.price > 0) {
                          setLotPrice(m.price);
                        }
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-zinc-900/40 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate">{m.ticker}</div>
                        <div className="text-[10px] font-bold text-zinc-500 truncate">{m.companyName}</div>
                      </div>
                      <div className="text-xs font-black text-emerald-400">{Number(m.price || 0).toLocaleString('tr-TR')} TL</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Alim Fiyati (Lot)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="number"
                  step="0.01"
                  value={lotPrice || ""}
                  onChange={(e) => {
                    setPriceTouched(true);
                    setLotPrice(Number(e.target.value));
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-12 text-white outline-none focus:border-blue-500 transition-all font-bold"
                  placeholder="Fiyat"
                />
                <button
                  type="button"
                  onClick={fetchPrice}
                  disabled={isFetchingPrice}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg border transition-all ${isFetchingPrice ? 'opacity-50 cursor-not-allowed bg-zinc-950 border-zinc-800 text-zinc-600' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-white hover:border-blue-500/50'}`}
                  title="BIST fiyatini cek"
                >
                  <RefreshCcw className={`w-4 h-4 ${isFetchingPrice ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Fiyat sadece sen tetikleyince guncellenir.</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Alim Turu</label>
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
                <button
                  onClick={() => setPurchaseType('ipo')}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${purchaseType === 'ipo' ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                >
                  H (ARZ)
                </button>
                <button
                  onClick={() => setPurchaseType('portfolio')}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${purchaseType === 'portfolio' ? 'bg-blue-500 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  P (PORTFOY)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Lot Giris Modu</label>
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
                <button
                  onClick={() => setMode('uniform')}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'uniform' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                >
                  Toplu Lot
                </button>
                <button
                  onClick={() => setMode('perAccount')}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'perAccount' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  Hesap Bazli
                </button>
              </div>
              {mode === 'uniform' && (
                <input
                  type="number"
                  value={uniformLots || ""}
                  onChange={(e) => setUniformLots(Number(e.target.value))}
                  className="mt-3 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all font-bold"
                  placeholder="Her hesaba lot"
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectAll(true)}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all"
              >
                Tumunu Sec
              </button>
              <button
                onClick={() => selectAll(false)}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all"
              >
                Temizle
              </button>
              <label className="flex items-center gap-2 text-xs text-zinc-400 font-bold">
                <input
                  type="checkbox"
                  checked={adjustCash}
                  onChange={(e) => setAdjustCash(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                Nakitten dus (toplam: {totalCost.toLocaleString('tr-TR')} TL)
              </label>
            </div>

            <button
              disabled={isSaving}
              onClick={handleSave}
              className={`px-8 py-3 rounded-xl font-black transition-all ${isSaving ? 'opacity-50 cursor-not-allowed bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
            >
              {isSaving ? "Kaydediliyor..." : `Toplu Alim Yap (${totalLots} Lot)`}
            </button>
          </div>

          <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-900/50">
                <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-900">
                  <th className="p-4">Sec</th>
                  <th className="p-4">Hesap</th>
                  <th className="p-4">Banka</th>
                  <th className="p-4">Aktif</th>
                  <th className="p-4 text-right">Lot</th>
                  <th className="p-4 text-right">Tahmini Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {rows.map((r: any) => {
                  const rowCost = (r._selected ? Number(r._lots || 0) : 0) * Number(lotPrice || 0);
                  return (
                    <tr key={r.id} className="hover:bg-zinc-900/30 transition-all">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={!!r._selected}
                          onChange={() => toggle(r.id)}
                          className="w-4 h-4 rounded accent-blue-500"
                        />
                      </td>
                      <td className="p-4 text-sm font-bold text-white">{r.ownerName}</td>
                      <td className="p-4 text-sm text-zinc-400 font-bold">{r.bankName}</td>
                      <td className="p-4 text-xs font-black">
                        <span className={`${r.isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>{r.isActive ? 'AKTIF' : 'PASIF'}</span>
                      </td>
                      <td className="p-4 text-right">
                        {mode === 'uniform' ? (
                          <span className="text-sm text-zinc-400 font-bold">{r._lots || 0}</span>
                        ) : (
                          <input
                            type="number"
                            value={Number(perAccountLots[r.id] || 0) || ""}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPerAccountLots(prev => ({ ...prev, [r.id]: val }));
                            }}
                            className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-sm text-white text-right"
                            placeholder="Lot"
                            disabled={!r._selected}
                          />
                        )}
                      </td>
                      <td className="p-4 text-right text-xs font-black text-zinc-400">{rowCost.toLocaleString('tr-TR')} TL</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
