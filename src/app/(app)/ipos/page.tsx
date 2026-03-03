"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, PlusCircle, Pencil, Search, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import OperationDashboard from "@/components/OperationDashboard";
import IpoModal from "@/components/IpoModal";
import { deleteIPO, processBatchOperation, saveIPO, getParticipationsForIPO, advanceIpoStatus, checkAndAdvanceIpoStatus, moveIpoToStocks } from "@/lib/data-service";
import { auth } from "@/lib/firebase";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { IPO_STATUSES, CAN_PARTICIPATE_STATUSES, getStatusColor, getStatusLabel, getNextStatus, getStatusDescription } from "@/constants/ipoStatuses";

function StatusBadge({ status }: { status: string }) {
  const colorClass = getStatusColor(status);
  const label = getStatusLabel(status);
  
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${colorClass}`}>
      {label}
    </span>
  );
}

function IpoCard({ ipo, accounts, onEdit, onOpenPanel }: { 
  ipo: any; 
  accounts: any[]; 
  onEdit: () => void; 
  onOpenPanel: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [accountData, setAccountData] = useState<any[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);
  
  const canParticipate = CAN_PARTICIPATE_STATUSES.includes(ipo.status);
  const nextStatus = getNextStatus(ipo.status);
  const statusDesc = getStatusDescription(ipo.status);

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

  const handleAdvanceStatus = async () => {
    if (!nextStatus || !confirm(`Durumu ilerletmek istiyor musunuz?\n${getStatusLabel(ipo.status)} → ${getStatusLabel(nextStatus)}`)) return;
    
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
              <p className="text-xl font-bold">{Number(ipo.price || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
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
                className="p-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white hover:border-emerald-500/30 transition-all"
                title="Duzenle"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white hover:border-emerald-500/30 transition-all"
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
              {ipo.status === "Borsada" ? "Hisse olarak takip ediliyor" : "Dağıtım yapıldı"}
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
            <div className="p-4 overflow-x-auto">
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
  const [editingIpo, setEditingIpo] = useState<any | null>(null);
  const [showIpoModal, setShowIpoModal] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [isAutoChecking, setIsAutoChecking] = useState(false);

  // Auto-check IPO statuses on load
  useEffect(() => {
    const checkStatuses = async () => {
      if (isAutoChecking || !ipos || ipos.length === 0) return;
      setIsAutoChecking(true);
      
      for (const ipo of ipos) {
        // Check and advance status based on dates
        const result = await checkAndAdvanceIpoStatus(ipo);
        if (result.advanced) {
          console.log(`Auto-advanced IPO ${ipo.ticker} to ${result.newStatus}`);
          // If listed, move to stocks
          if (result.newStatus === "listeleme") {
            await moveIpoToStocks(ipo);
          }
        }
      }
      
      setIsAutoChecking(false);
    };
    
    checkStatuses();
  }, [ipos]);

  const threeMonthsAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.getTime();
  })();

  const filteredIpos = ipos.filter((ipo: any) => {
    const status = String(ipo.status || "");
    
    // Show all 7 stages of IPO
    const allStatuses = ["duyuru", "basvuru_acik", "talep_toplaniyor", "talep_kapandi", "tahsis", "sonuclar", "listeleme"];
    // Also support legacy statuses
    const legacyStatuses = ["Duyuru", "Onaylandı", "Talep Toplanıyor", "Yolda", "Dağıtıldı", "Borsada"];
    
    if (!allStatuses.includes(status) && !legacyStatuses.includes(status)) return false;

    const t = new Date(ipo.createdAt || ipo.updatedAt || 0).getTime();
    if (!Number.isFinite(t) || t <= 0) return false;
    if (t < threeMonthsAgo) return false;

    if (searchQ) {
      const q = searchQ.toLowerCase();
      const ticker = String(ipo.ticker || "").toLowerCase();
      const companyName = String(ipo.companyName || "").toLowerCase();
      if (!ticker.includes(q) && !companyName.includes(q)) {
        return false;
      }
    }
    
    return true;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold">Halka Arzlar (Son 3 Ay)</h2>
          <span className="text-zinc-500 font-normal text-sm">({filteredIpos.length})</span>
          <Link
            href="/stocks"
            className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all"
          >
            Tum Hisseler
          </Link>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Halka arz ara..."
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
                alert(`Tarama tamamlandi. Bulunan: ${data.discovered}, Yeni: ${data.created}, Guncellenen: ${data.updated}`);
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

      <div className="space-y-4">
        {filteredIpos.map((ipo: any) => (
          <IpoCard 
            key={ipo.id} 
            ipo={ipo} 
            accounts={accounts}
            onEdit={() => {
              setEditingIpo(ipo);
              setShowIpoModal(true);
            }}
            onOpenPanel={() => setActiveIpo(ipo)}
          />
        ))}
        {filteredIpos.length === 0 && (
          <div className="col-span-full p-10 text-center rounded-3xl border border-zinc-800 bg-zinc-900/20 text-zinc-500 font-bold">
            Son 3 ay icinde yeni halka arz kaydi yok. Tum hisseler icin <Link href="/stocks" className="text-emerald-400">/stocks</Link> sayfasini kullan.
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeIpo && user && Array.isArray(accounts) && accounts.length > 0 && (
          <OperationDashboard
            ipo={{ id: activeIpo.id, name: activeIpo.companyName, price: activeIpo.price, totalOfferedLots: activeIpo.totalOfferedLots }}
            accounts={accounts}
            onClose={() => setActiveIpo(null)}
            onSave={async (data, mode) => {
              await processBatchOperation(user.uid, activeIpo.id, activeIpo.price, data, mode);
              await refreshData();
            }}
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
