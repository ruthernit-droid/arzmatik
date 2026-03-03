"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, PlusCircle } from "lucide-react";
import { addHoldingToAccount, saveIPO, updateIpoPrice } from "@/lib/data-service";
import { fetchLatestPriceTwelve } from "@/lib/price-service";

export default function AddHoldingModal({
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
  const [accountId, setAccountId] = useState<string>(accounts?.[0]?.id || "");
  const [ticker, setTicker] = useState<string>("");
  const [lots, setLots] = useState<number>(0);
  const [lotPrice, setLotPrice] = useState<number>(0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [autoPrice, setAutoPrice] = useState<number | null>(null);
  const [isAutoPricing, setIsAutoPricing] = useState(false);
  const autoReqId = useRef(0);
  const [purchaseType, setPurchaseType] = useState<'ipo' | 'portfolio'>('portfolio');
  const [adjustCash, setAdjustCash] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const lastLiveFetchRef = useRef<Record<string, number>>({});

  const estimatedCost = useMemo(() => Number(lots || 0) * Number(lotPrice || 0), [lots, lotPrice]);

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

  const selectedIpo = useMemo(() => {
    const t = ticker.trim().toUpperCase();
    if (!t) return null;
    return (ipos || []).find((i: any) => String(i.ticker || "").toUpperCase() === t) || null;
  }, [ipos, ticker]);

  const ipoReferencePrice = useMemo(() => {
    if (!selectedIpo) return 0;
    const explicitIpoPrice = Number((selectedIpo as any).ipoPrice || 0);
    if (explicitIpoPrice > 0) return explicitIpoPrice;
    const status = String((selectedIpo as any).status || "");
    // If this record is a real IPO flow (not generic stock), treat current price as IPO price fallback.
    if (status && status !== "Borsada İşlem Görüyor") {
      return Number((selectedIpo as any).price || 0);
    }
    return 0;
  }, [selectedIpo]);

  const lastKnownPrice = useMemo(() => {
    const p = Number(autoPrice || 0);
    if (p > 0) return p;
    return Number((selectedIpo as any)?.price || 0);
  }, [autoPrice, selectedIpo]);

  useEffect(() => {
    const t = ticker.trim().toUpperCase();
    if (t.length < 3) {
      setAutoPrice(null);
      return;
    }

    const id = ++autoReqId.current;
    setIsAutoPricing(true);
    const tm = setTimeout(async () => {
      try {
        const p = await fetchLatestPriceTwelve(t);
        if (autoReqId.current !== id) return;
        if (p) {
          setAutoPrice(p);
          if (!priceTouched && (!lotPrice || lotPrice <= 0)) {
            setLotPrice(p);
          }
        }
      } catch {
        // ignore
      } finally {
        if (autoReqId.current === id) setIsAutoPricing(false);
      }
    }, 700);

    return () => {
      clearTimeout(tm);
    };
  }, [ticker, lotPrice, priceTouched]);

  useEffect(() => {
    // When user enters lot quantity for a selected stock, fetch live price and persist latest price.
    if (!selectedIpo?.id) return;
    if (!lots || lots <= 0) return;

    const t = String(selectedIpo.ticker || "").toUpperCase();
    if (!t) return;

    const now = Date.now();
    const prev = lastLiveFetchRef.current[t] || 0;
    if (now - prev < 15000) return; // prevent spam while user edits quantity

    const id = ++autoReqId.current;
    setIsAutoPricing(true);
    const tm = setTimeout(async () => {
      try {
        const p = await fetchLatestPriceTwelve(t);
        if (autoReqId.current !== id) return;
        if (p && p > 0) {
          setAutoPrice(p);
          lastLiveFetchRef.current[t] = Date.now();
          // Persist the latest known market price immediately.
          await updateIpoPrice(String(selectedIpo.id), p);
          if (!priceTouched && (!lotPrice || lotPrice <= 0)) {
            setLotPrice(p);
          }
        }
      } catch {
        // ignore
      } finally {
        if (autoReqId.current === id) setIsAutoPricing(false);
      }
    }, 500);

    return () => clearTimeout(tm);
  }, [lots, selectedIpo?.id, selectedIpo?.ticker, lotPrice, priceTouched]);

  const selectedAccount = useMemo(
    () => accounts.find((a: any) => a.id === accountId),
    [accounts, accountId]
  );

  const handleSave = async () => {
    const t = ticker.trim().toUpperCase();
    if (!accountId) {
      alert("Lutfen bir hesap secin!");
      return;
    }
    if (!t) {
      alert("Lutfen ticker girin!");
      return;
    }
    if (!lots || lots <= 0) {
      alert("Lutfen gecerli bir lot girin!");
      return;
    }
    if (!lotPrice || lotPrice <= 0) {
      alert("Lutfen gecerli bir alim fiyati (lot) girin!");
      return;
    }
    if (purchaseType !== 'ipo' && purchaseType !== 'portfolio') {
      alert("Lutfen alim turunu secin (H/P)!");
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
      } else if (!existing?.price) {
        // If we have an IPO record but no price yet, seed it.
        await updateIpoPrice(ipoId, lotPrice);
      }

      await addHoldingToAccount(userId, accountId, ipoId, lots, purchaseType, lotPrice, adjustCash);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Kaydetme sirasinda hata olustu!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
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
        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Hisse Ekle</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Hesap</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white outline-none focus:border-blue-500 transition-all font-medium text-lg"
              >
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.ownerName} - {a.bankName}
                  </option>
                ))}
              </select>
              {selectedAccount && (
                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                  Mevcut Nakit: {(selectedAccount.cashBalance || 0).toLocaleString('tr-TR')} TL
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Ticker</label>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all font-mono font-bold"
                placeholder="ORNEK: THYAO"
              />
              <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">BIST icin otomatik .IS eklenir (fiyat guncellemede).</div>
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
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Lot</label>
              <input
                type="number"
                inputMode="decimal"
                value={lots || ""}
                onChange={(e) => setLots(Number(e.target.value))}
                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white outline-none focus:border-blue-500 transition-all font-bold text-lg"
                placeholder="Orn: 100"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Alim Fiyati (Lot)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (ipoReferencePrice > 0) {
                      setPriceTouched(true);
                      setLotPrice(ipoReferencePrice);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${ipoReferencePrice > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' : 'bg-zinc-950 border-zinc-800 text-zinc-600 cursor-not-allowed'}`}
                  disabled={ipoReferencePrice <= 0}
                >
                  Halka Arz Fiyati
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lastKnownPrice > 0) {
                      setPriceTouched(true);
                      setLotPrice(lastKnownPrice);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${lastKnownPrice > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20' : 'bg-zinc-950 border-zinc-800 text-zinc-600 cursor-not-allowed'}`}
                  disabled={lastKnownPrice <= 0}
                >
                  Son Fiyat
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={lotPrice || ""}
                onChange={(e) => {
                  setPriceTouched(true);
                  setLotPrice(Number(e.target.value));
                }}
                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white outline-none focus:border-blue-500 transition-all font-bold text-lg"
                placeholder="Orn: 307.5"
              />
              <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                {isAutoPricing ? "Fiyat cekiliyor..." : autoPrice ? `Canli Fiyat: ${autoPrice.toLocaleString('tr-TR')} TL` : ""}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 uppercase tracking-widest font-black">Alim Turu:</span>
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
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

            <label className="flex items-center gap-2 text-xs text-zinc-400 font-bold">
              <input
                type="checkbox"
                checked={adjustCash}
                onChange={(e) => setAdjustCash(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              Nakitten dus ({estimatedCost.toLocaleString('tr-TR')} TL)
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-2">
            <button onClick={onClose} className="px-6 py-3 text-zinc-500 hover:text-white font-bold transition-colors">
              Iptal
            </button>
            <button
              disabled={isSaving}
              onClick={handleSave}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black transition-all ${isSaving ? 'opacity-50 cursor-not-allowed bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
            >
              <PlusCircle className="w-4 h-4" /> {isSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
