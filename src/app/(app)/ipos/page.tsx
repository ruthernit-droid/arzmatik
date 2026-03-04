"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronRight, PlusCircle, Pencil, Search, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import OperationDashboard from "@/components/OperationDashboard";
import SellDashboard from "@/components/SellDashboard";
import BackfillWizardModal from "@/components/BackfillWizardModal";
import IpoModal from "@/components/IpoModal";
import { deleteIPO, processBatchOperation, saveIPO, getParticipationsForIPO, advanceIpoStatus, checkAndAdvanceIpoStatus, moveIpoToStocks } from "@/lib/data-service";
import { auth } from "@/lib/firebase";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { IPO_STATUSES, CAN_PARTICIPATE_STATUSES, getStatusColor, getStatusLabel, getNextStatus, getStatusDescription, normalizeIpoStatus } from "@/constants/ipoStatuses";

function parseIpoReferenceTs(ipo: any): number {
  const candidates = [
    ipo?.demandEndDate,
    ipo?.applicationEndDate,
    ipo?.applicationStartDate,
    ipo?.announcementDate,
    ipo?.createdAt,
    ipo?.updatedAt,
  ];
  for (const value of candidates) {
    const ts = new Date(String(value || "")).getTime();
    if (Number.isFinite(ts) && ts > 0) return ts;
  }
  return 0;
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = getStatusColor(status);
  const label = getStatusLabel(status);
  
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${colorClass}`}>
      {label}
    </span>
  );
}

function IpoCard({ ipo, accounts, onEdit, onOpenPanel, onOpenBackfillDemand, onOpenBackfillDistribution, onOpenBackfillSell, onOpenBackfillWizard }: { 
  ipo: any; 
  accounts: any[]; 
  onEdit: () => void; 
  onOpenPanel: () => void;
  onOpenBackfillDemand: () => void;
  onOpenBackfillDistribution: () => void;
  onOpenBackfillSell: () => void;
  onOpenBackfillWizard: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [accountData, setAccountData] = useState<any[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const normalizedStatus = normalizeIpoStatus(String(ipo.status || ""));
  const demandEndTs = new Date(String(ipo.demandEndDate || "")).getTime();
  const demandStillOpen = !(Number.isFinite(demandEndTs) && demandEndTs > 0 && demandEndTs <= Date.now());
  const canParticipate = CAN_PARTICIPATE_STATUSES.includes(normalizedStatus) && demandStillOpen;
  const nextStatus = getNextStatus(normalizedStatus);
  const statusDesc = getStatusDescription(normalizedStatus);

  useEffect(() => {
    if (isExpanded) {
      const userId = auth.currentUser?.uid;
      if (userId) {
        getParticipationsForIPO(userId, accounts.map(a => a.id), ipo.id).then(data => {
          setAccountData(accounts.map(acc => {
            const p = data.find((d: any) => d.accountId === acc.id);
            return {
              ...acc,
              requestedLots: p?.requestedLots || 0,
              allottedLots: p?.allottedLots || 0,
              status: p?.status || 'Bekliyor',
              purchaseType: p?.purchaseType || 'ipo'
            };
          }));
        });
      }
    }
  }, [isExpanded, ipo.id, accounts]);

  const totalRequested = accountData.reduce((sum, acc) => sum + (acc.requestedLots || 0), 0);
  const totalCost = totalRequested * (ipo.price || 0);
  const recommendedLot = Number(ipo.recommendedLot || 0);

  const tavanRows = Array.from({ length: 13 }, (_, idx) => {
    const day = idx + 1;
    const basePrice = Number(ipo.price || 0);
    const projectedPrice = basePrice * Math.pow(1.1, day);
    const profitPct = (Math.pow(1.1, day) - 1) * 100;
    const profitAmount = Math.max(0, Number(recommendedLot || 0)) * (projectedPrice - basePrice);
    return { day, projectedPrice, profitPct, profitAmount };
  });

  const handleAdvanceStatus = async () => {
    if (!nextStatus) return;

    const normalized = normalizeIpoStatus(String(ipo.status || ""));
    
    // Validation checks before advancing
    if (normalized === "talep_toplaniyor" || normalized === "talep_kapandi") {
        const hasDemand = accountData.some((a: any) => (a.requestedLots || 0) > 0);
        if (!hasDemand) {
            alert("Hata: Bu aşamaya geçmek için önce talep girişi yapmalısınız!");
            return;
        }
        if (!confirm(`UYARI: Talep girilmemiş hesaplar var. Yine de ilerletmek istiyor musunuz?`)) return;
    }

    if (normalized === "tahsis" || normalized === "sonuclar") {
        const hasDistribution = accountData.some((a: any) => (a.allottedLots || 0) > 0);
        if (!hasDistribution) {
            alert("Hata: Bu aşamaya geçmek için önce dağıtım sonuçlarını girmelisiniz!");
            return;
        }
        if (!confirm(`UYARI: Dağıtım girilmemiş hesaplar var. Yine de ilerletmek istiyor musunuz?`)) return;
    }

    if (!confirm(`Durumu ilerletmek istiyor musunuz?\n${getStatusLabel(ipo.status)} → ${getStatusLabel(nextStatus)}`)) return;
    
    setIsAdvancing(true);
    try {
      const result = await advanceIpoStatus(ipo.id);
      if (result.success) {
        alert(`Durum başarıyla güncellendi: ${result.newStatus}`);
        window.location.reload();
      } else {
        alert(`Hata: ${result.error}`);
      }
    } catch (e) {
      alert(`Hata: ${e}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div className="glass-card border border-zinc-800 overflow-hidden">
      <div className="p-6 hover:bg-zinc-900/40 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex gap-4 items-center flex-1">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center font-black text-zinc-400">
              {ipo.ticker?.[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={ipo.status} />
                {statusDesc && <span className="text-xs text-zinc-500">• {statusDesc}</span>}
              </div>
              <h4 className="text-lg font-bold">{ipo.companyName}</h4>
              <p className="text-xs text-zinc-500 font-bold">{ipo.ticker}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-black">Fiyat</p>
              <p className="text-xl font-bold">{Number(ipo.price || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</p>
            </div>
            
            <div className="flex flex-col gap-1">
              {nextStatus && (
                <button
                  onClick={handleAdvanceStatus}
                  disabled={isAdvancing}
                  className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 hover:bg-emerald-500/30 transition-all text-[10px] font-bold"
                  title={`İlerlet: ${getStatusLabel(nextStatus)}`}
                >
                  {isAdvancing ? "..." : "→"}
                </button>
              )}
              <button
                onClick={onEdit}
                className="p-2 bg-zinc-200 border border-zinc-300 rounded-xl text-zinc-800 hover:text-black hover:border-emerald-500 transition-all"
                title="Duzenle"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 bg-zinc-200 border border-zinc-300 rounded-xl text-zinc-800 hover:text-black hover:border-emerald-500 transition-all"
                title={isExpanded ? "Kapat" : "Ac"}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Toplam Talep</p>
              <p className="text-sm font-bold text-amber-400">{totalRequested.toLocaleString('tr-TR')} Lot</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Toplam Maliyet</p>
              <p className="text-sm font-bold text-rose-400">{totalCost.toLocaleString('tr-TR')} ₺</p>
            </div>
          </div>

          {canParticipate ? (
            <button
              onClick={onOpenPanel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              İşlem Paneli <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-xl text-xs text-zinc-500">
              <AlertCircle className="w-4 h-4" />
              {normalizedStatus === "listeleme"
                ? "Listelendi: Dagitim sonuclari tamamlandi mi kontrol edin"
                : normalizedStatus === "sonuclar"
                ? "Sonuclar aciklandi: Dagitimi hesaplara girin"
                : "Talep donemi disinda"}
            </div>
          )}
        </div>

      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800 bg-zinc-950/50 overflow-hidden"
          >
            <div className="p-4 space-y-4 overflow-x-auto">
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-black text-zinc-300 uppercase tracking-widest">Olasi Tavan K/Z (13 Gun)</h5>
                  <span className="text-[10px] text-zinc-500">Gunluk tavan varsayimi: %10</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[420px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                        <th className="py-1 pr-2">Tavan</th>
                        <th className="py-1 px-2 text-right">Tahmini Fiyat</th>
                        <th className="py-1 px-2 text-right">Kar %</th>
                        <th className="py-1 pl-2 text-right">Kar (TL)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tavanRows.map((row) => (
                        <tr key={row.day} className="border-b border-zinc-900 text-xs">
                          <td className="py-1 pr-2 font-bold">{row.day}. Tavan</td>
                          <td className="py-1 px-2 text-right font-mono">{row.projectedPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-1 px-2 text-right text-emerald-300">%{row.profitPct.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-1 pl-2 text-right text-emerald-400 font-bold">{row.profitAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-2">
                <h5 className="text-xs font-black text-zinc-300 uppercase tracking-widest">Gecmise Donuk Duzeltme</h5>
                <p className="text-[11px] text-zinc-500">Reelde yapilip projeye islenmeyen islemleri buradan isleyin.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onOpenBackfillWizard}
                    className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[11px] font-bold"
                  >
                    Duzeltme Sihirbazi
                  </button>
                  <button
                    type="button"
                    onClick={onOpenBackfillDemand}
                    className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-bold"
                  >
                    Talep Duzelt
                  </button>
                  <button
                    type="button"
                    onClick={onOpenBackfillDistribution}
                    className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-[11px] font-bold"
                  >
                    Dagitim Duzelt
                  </button>
                  <button
                    type="button"
                    onClick={onOpenBackfillSell}
                    className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[11px] font-bold"
                  >
                    Satis Duzelt
                  </button>
                </div>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800">
                    <th className="p-2">Hesap</th>
                    <th className="p-2">Sahip</th>
                    <th className="p-2 text-right">Talep (Lot)</th>
                    <th className="p-2 text-right">Maliyet</th>
                    <th className="p-2">Durum</th>
                    <th className="p-2">Tur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {accountData.filter(a => a.requestedLots > 0).map(acc => (
                    <tr key={acc.id} className="hover:bg-zinc-900/30">
                      <td className="p-2 font-mono text-xs text-zinc-400">{acc.accountNumber}</td>
                      <td className="p-2 font-bold text-sm">{acc.ownerName}</td>
                      <td className="p-2 text-right font-bold text-amber-400">{acc.requestedLots}</td>
                      <td className="p-2 text-right font-mono text-xs">{(acc.requestedLots * (ipo.price || 0)).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</td>
                      <td className="p-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          acc.status === 'Talepte' ? 'bg-amber-500/20 text-amber-400' :
                          acc.status === 'Dağıtıldı' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          {acc.status}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          acc.purchaseType === 'ipo' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {acc.purchaseType === 'ipo' ? 'H' : 'P'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {accountData.filter(a => a.requestedLots > 0).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-zinc-500 text-sm">
                        Bu halka arz icin henuz talep girilmemis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function IposPage() {
  const { ipos, accounts, user, refreshData } = useFirebaseDataContext();
  const [activeIpo, setActiveIpo] = useState<any | null>(null);
  const [operationMode, setOperationMode] = useState<'talep' | 'dagitim'>('talep');
  const [editingIpo, setEditingIpo] = useState<any | null>(null);
  const [showIpoModal, setShowIpoModal] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const autoCheckingRef = useRef(false);
  const [showStockList, setShowStockList] = useState(false);
  const [showAllIpos, setShowAllIpos] = useState(false);
  const [activeSellTicker, setActiveSellTicker] = useState<string | null>(null);
  const [activeSellParticipationId, setActiveSellParticipationId] = useState<string | null>(null);
  const [activeSellParticipations, setActiveSellParticipations] = useState<any[]>([]);
  const [showSellModal, setShowSellModal] = useState(false);
  const [wizardIpo, setWizardIpo] = useState<any | null>(null);

  // Auto-check IPO statuses on load
  useEffect(() => {
    const checkStatuses = async () => {
      if (autoCheckingRef.current || !ipos || ipos.length === 0) return;
      autoCheckingRef.current = true;

      try {
        for (const ipo of ipos) {
          const result = await checkAndAdvanceIpoStatus(ipo);
          if (result.advanced) {
            console.log(`Auto-advanced IPO ${ipo.ticker} to ${result.newStatus}`);
            if (result.newStatus === "listeleme") {
              await moveIpoToStocks(ipo);
            }
          }
        }
      } finally {
        autoCheckingRef.current = false;
      }
    };
    
    checkStatuses();
  }, [ipos]);

  const oneMonthAgoTs = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getTime();
  }, []);

  const stockRows = useMemo(() => {
    const query = searchQ.trim().toLowerCase();
    const rows = (ipos || [])
      .filter((i: any) => {
        const rawStatus = String(i.status || "");
        const normalized = normalizeIpoStatus(rawStatus);
        return (
          normalized === "listeleme" ||
          rawStatus === "Borsada İşlem Görüyor" ||
          String(i.source || "") === "twelvedata"
        );
      })
      .map((i: any) => ({
        id: i.id,
        ticker: String(i.ticker || "").toUpperCase(),
        companyName: String(i.companyName || ""),
        price: Number(i.price || 0),
        status: String(i.status || ""),
      }))
      .sort((a: any, b: any) => a.ticker.localeCompare(b.ticker, "tr"));

    if (!query) return rows;
    return rows.filter((r: any) =>
      r.ticker.toLowerCase().includes(query) || r.companyName.toLowerCase().includes(query)
    );
  }, [ipos, searchQ]);

  const stockTickerSet = useMemo(() => {
    return new Set(stockRows.map((s: any) => String(s.ticker || "").toUpperCase()).filter(Boolean));
  }, [stockRows]);

  const filteredIpos = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return (ipos || []).filter((ipo: any) => {
      const status = normalizeIpoStatus(String(ipo.status || ""));
      const allStatuses = IPO_STATUSES.map((s) => s.id);
      if (!allStatuses.includes(status)) return false;

      if (status === "listeleme" && !showAllIpos) return false;

      const ticker = String(ipo.ticker || "").toUpperCase();
      if (ticker && stockTickerSet.has(ticker) && !showAllIpos) return false;

      const refTs = parseIpoReferenceTs(ipo);
      if (!showAllIpos && Number.isFinite(refTs) && refTs > 0 && refTs < oneMonthAgoTs) {
        return false;
      }

      if (q) {
        const companyName = String(ipo.companyName || "").toLowerCase();
        if (!ticker.toLowerCase().includes(q) && !companyName.includes(q)) return false;
      }

      return true;
    });
  }, [ipos, searchQ, stockTickerSet, showAllIpos, oneMonthAgoTs]);

  const onSaveIpo = async (data: any) => {
    await saveIPO(data);
    setShowIpoModal(false);
    setEditingIpo(null);
    await refreshData();
  };

  const onDeleteIpo = async (id: string) => {
    if (!confirm("Bu halka arzi silmek istiyor musun?")) return;
    await deleteIPO(id);
    setShowIpoModal(false);
    setEditingIpo(null);
    await refreshData();
  };

  const openBackfillOperation = (ipo: any, mode: 'talep' | 'dagitim') => {
    setOperationMode(mode);
    setActiveIpo(ipo);
  };

  const openBackfillSell = async (ipo: any) => {
    if (!user) return;
    const parts = await getParticipationsForIPO(user.uid, accounts.map((a: any) => a.id), ipo.id, ipo.ticker);
    setActiveSellParticipations(parts.map((p: any) => ({ ...p, price: Number(ipo.price || 0) })));
    setActiveSellTicker(String(ipo.ticker || ipo.companyName || "HISSE"));
    setActiveSellParticipationId(ipo.id);
    setShowSellModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold">H. Arz ve Hisseler</h2>
          <span className="text-zinc-500 font-normal text-sm">({filteredIpos.length})</span>
          <button
            type="button"
            onClick={() => setShowAllIpos((prev: boolean) => !prev)}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${showAllIpos ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900"}`}
          >
            {showAllIpos ? "Tumunu Goster (Aktif)" : "Tumunu Goster (Arsiv)"}
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="H. arz veya hisse ara..."
            className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-all w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingIpo(null);
              setShowIpoModal(true);
            }}
            className="flex items-center gap-2 text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-all px-4 py-2 bg-emerald-500/10 rounded-xl"
          >
            <PlusCircle className="w-4 h-4" /> Halka Arz Ekle
          </button>
          <button
            onClick={async () => {
              if (!user) return;
              setIsDiscovering(true);
              try {
                const { auth } = await import("@/lib/firebase");
                const token = await auth?.currentUser?.getIdToken?.();
                const res = await fetch('/api/ipo/discover_halkarz', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ apply: true, max: 50 }),
                });
                const text = await res.text();
                let data: any = null;
                try {
                  data = JSON.parse(text);
                } catch {
                  throw new Error(`JSON disi yanit alindi: ${text.slice(0, 120)}`);
                }
                if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                await refreshData();
                alert(`Tarama tamamlandi. Bulunan: ${data.discovered}, Yeni: ${data.created}, Guncellenen: ${data.updated}, Hisse listesinde oldugu icin atlanan: ${data.skippedListed || 0}, Fiyatli: ${data.withPrice || 0}, Tarihli: ${data.withDates || 0}`);
              } catch (e: any) {
                console.error(e);
                alert(`Yeni arz taramasi basarisiz: ${String(e?.message || e)}`);
              } finally {
                setIsDiscovering(false);
              }
            }}
            disabled={isDiscovering}
            className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2 rounded-xl border ${isDiscovering ? 'opacity-50 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500' : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 border-amber-500/20'}`}
          >
            {isDiscovering ? 'Taranıyor...' : 'Yeni Arzları Tara'}
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400 space-y-1">
          <p className="font-bold text-zinc-300">Kullanim Senaryosu - Gecmise Donuk Duzeltme</p>
          <p>1) Reelde katildiniz ama projeye islemediniz: karti acin, <span className="text-amber-300">Talep Duzelt</span> ile talebi girin.</p>
          <p>2) Dagitim/satis da olduysa: sirayla <span className="text-blue-300">Dagitim Duzelt</span> ve <span className="text-rose-300">Satis Duzelt</span> islemlerini yapin.</p>
          <p>3) Tarih takvimi gecmis olsa bile duzeltme butonlariyla tek hesap veya tum hesaplara geriye donuk isleyebilirsiniz.</p>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-300 uppercase tracking-widest">Halka Arzlar (Son 1 Ay)</h3>
          <span className="text-xs text-zinc-500">Talep donemi bitenler burada gizlenir</span>
        </div>
        {filteredIpos.map((ipo: any) => (
          <IpoCard 
            key={ipo.id} 
            ipo={ipo} 
            accounts={accounts}
            onEdit={() => {
              setEditingIpo(ipo);
              setShowIpoModal(true);
            }}
            onOpenPanel={() => {
              setOperationMode('talep');
              setActiveIpo(ipo);
            }}
            onOpenBackfillDemand={() => openBackfillOperation(ipo, 'talep')}
            onOpenBackfillDistribution={() => openBackfillOperation(ipo, 'dagitim')}
            onOpenBackfillSell={() => openBackfillSell(ipo).catch((e) => { console.error(e); alert("Satis duzeltme acilamadi"); })}
            onOpenBackfillWizard={() => setWizardIpo(ipo)}
          />
        ))}
        {filteredIpos.length === 0 && (
          <div className="col-span-full p-10 text-center rounded-3xl border border-zinc-800 bg-zinc-900/20 text-zinc-500 font-bold">
            Son 1 ay icin gosterilecek halka arz kaydi yok.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setShowStockList((prev) => !prev)}
          className="w-full px-4 py-3 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-between"
        >
          <span className="text-sm font-black">Gercek Hisse Listesi ({stockRows.length})</span>
          <span className="text-xs text-zinc-500">{showStockList ? "Gizle" : "Ac"}</span>
        </button>

        {showStockList && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stockRows.map((s: any) => (
              <Link
                key={s.id}
                href="/stocks"
                className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-base">{s.ticker}</p>
                    <p className="text-xs text-zinc-500 truncate">{s.companyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">{Number(s.price || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</p>
                    <p className="text-[10px] text-zinc-500">{String(s.status || "-")}</p>
                  </div>
                </div>
              </Link>
            ))}
            {stockRows.length === 0 && (
              <div className="p-6 rounded-xl bg-zinc-900/20 border border-zinc-800 text-sm text-zinc-500">
                Hisse listesinde gosterilecek kayit yok.
              </div>
            )}
          </div>
        )}
      </section>

      <AnimatePresence>
        {activeIpo && user && Array.isArray(accounts) && accounts.length > 0 && (
          <OperationDashboard
            ipo={{ id: activeIpo.id, name: activeIpo.companyName, price: activeIpo.price, totalOfferedLots: activeIpo.totalOfferedLots }}
            accounts={accounts}
            initialMode={operationMode}
            onClose={() => setActiveIpo(null)}
            onSave={async (data, mode) => {
              await processBatchOperation(user.uid, activeIpo.id, activeIpo.price, data, mode);
              await refreshData();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSellModal && activeSellTicker && activeSellParticipationId && (
          <SellDashboard
            participationId={activeSellParticipationId}
            ticker={activeSellTicker}
            accounts={accounts}
            participations={activeSellParticipations}
            onClose={() => setShowSellModal(false)}
            onSave={() => refreshData()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wizardIpo && (
          <BackfillWizardModal
            ipo={{ id: wizardIpo.id, ticker: wizardIpo.ticker, companyName: wizardIpo.companyName, price: Number(wizardIpo.price || 0) }}
            accounts={accounts}
            onClose={() => setWizardIpo(null)}
            onSaved={refreshData}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIpoModal && (
          <IpoModal
            ipo={editingIpo}
            onClose={() => {
              setShowIpoModal(false);
              setEditingIpo(null);
            }}
            onSave={onSaveIpo}
            onDelete={(id) => onDeleteIpo(id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
