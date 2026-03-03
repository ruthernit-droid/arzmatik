"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  DollarSign,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Plus,
  ShoppingCart,
  ArrowUpRight,
} from "lucide-react";

import SellDashboard from "@/components/SellDashboard";
import SellSelectorModal from "@/components/SellSelectorModal";
import AddHoldingModal from "@/components/AddHoldingModal";
import BulkPortfolioBuyModal from "@/components/BulkPortfolioBuyModal";

import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { cleanupUserData, updateIpoPrice } from "@/lib/data-service";
import { fetchLatestPriceTwelve } from "@/lib/price-service";

function StatCard({ title, value, icon, color = "emerald" }: { title: string; value: string; icon: React.ReactNode; color?: "emerald" | "blue" | "rose" }) {
  const colorClasses = {
    emerald: "text-emerald-500",
    blue: "text-blue-400",
    rose: "text-rose-500",
  };
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-xl bg-zinc-950 border border-zinc-800 ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">{title}</p>
        <p className="text-xl font-black">{value}</p>
      </div>
    </div>
  );
}

function PortfolioCard({ item, ipo, onSell, isLoading }: { item: any; ipo: any; onSell: () => void; isLoading: boolean }) {
  const price = Number(ipo?.price || 0);
  const cost = Number(item.totalCost || 0);
  const value = Number(item.totalLots || 0) * price;
  const pnl = value - cost;
  const pnlPercent = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : "0";

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center font-bold text-lg border border-zinc-800">
            {item.ticker?.slice(0, 2)}
          </div>
          <div>
            <p className="font-bold text-lg">{item.ticker}</p>
            <div className="flex gap-1.5 mt-1">
              {item.types?.map((t: string) => (
                <span key={t} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${t === "ipo" ? "bg-amber-500/20 text-amber-500" : "bg-blue-500/20 text-blue-500"}`}>
                  {t === "ipo" ? "HALK.A." : "PORTF."}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-bold text-lg ${pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {pnl >= 0 ? "+" : ""}{pnl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </p>
          <p className={`text-xs font-medium ${pnl >= 0 ? "text-emerald-500/70" : "text-rose-500/70"}`}>
            %{pnlPercent}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-3 bg-zinc-950/50 rounded-xl p-3">
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase">Lot</p>
          <p className="font-bold text-base">{item.totalLots}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase">Maliyet</p>
          <p className="font-bold text-base text-zinc-300">{cost.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
        </div>
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase">Guncel Deger</p>
          <p className="font-bold text-base text-emerald-400">{value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
        </div>
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase">Fiyat</p>
          <p className="font-bold text-base">{price.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
        </div>
      </div>

      <button
        onClick={onSell}
        disabled={isLoading}
        className={`w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
          isLoading 
            ? "bg-zinc-800 text-zinc-500" 
            : "bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500 hover:text-white"
        }`}
      >
        <ArrowUpRight className="w-5 h-5" />
        {isLoading ? "Yukleniyor..." : "Sat"}
      </button>
    </div>
  );
}

export default function PortfolioPage() {
  const { accounts, ipos, portfolioItems, user, refreshData } = useFirebaseDataContext();

  const [activeSellTicker, setActiveSellTicker] = useState<string | null>(null);
  const [activeSellParticipationId, setActiveSellParticipationId] = useState<string | null>(null);
  const [activeParticipations, setActiveParticipations] = useState<any[]>([]);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showSellSelector, setShowSellSelector] = useState(false);
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);
  const [showBulkPortfolioBuyModal, setShowBulkPortfolioBuyModal] = useState(false);

  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [openingSellKey, setOpeningSellKey] = useState<string | null>(null);

  const totals = useMemo(() => {
    const totalCash = accounts.reduce((sum, acc) => sum + (acc.cashBalance || 0), 0);
    const totalCost = portfolioItems.reduce((sum: number, item: any) => sum + Number(item.totalCost || 0), 0);
    const totalStockValue = portfolioItems.reduce((sum: number, item: any) => {
      const ipo = ipos.find((i: any) => i.id === item.ipoId) || ipos.find((i: any) => i.ticker?.toUpperCase() === item.ticker?.toUpperCase());
      return sum + (Number(item.totalLots || 0) * Number(ipo?.price || 0));
    }, 0);
    const totalValue = totalCash + totalStockValue;
    const pnl = totalStockValue - totalCost;
    return { totalCash, totalCost, totalStockValue, totalValue, pnl };
  }, [accounts, ipos, portfolioItems]);

  const openSellForHolding = async (item: any) => {
    if (!user) return;
    const key = String(item.ipoId || item.ticker);
    setOpeningSellKey(key);
    const ipo = ipos.find((i: any) => i.id === item.ipoId) || ipos.find((i: any) => i.ticker?.toUpperCase() === item.ticker?.toUpperCase());
    const price = Number(ipo?.price || 0);

    const { getParticipationsForIPO } = await import("@/lib/data-service");
    const parts = await getParticipationsForIPO(user.uid, accounts.map((a: any) => a.id), item.ipoId || item.ticker, item.ticker);
    setActiveParticipations(parts.map((p: any) => ({ ...p, price })));
    setActiveSellTicker(item.ticker);
    setActiveSellParticipationId(item.ipoId || item.ticker);
    setShowSellSelector(false);
    setShowSellModal(true);
    setOpeningSellKey(null);
  };

  const refreshPrices = async () => {
    if (!user) return;
    if (portfolioItems.length === 0) return;
    setIsRefreshingPrices(true);
    try {
      for (const item of portfolioItems) {
        try {
          const price = await fetchLatestPriceTwelve(item.ticker);
          if (!price) continue;
          const ipo = ipos.find((i: any) => String(i.ticker || "").toUpperCase() === String(item.ticker || "").toUpperCase());
          if (ipo) {
            await updateIpoPrice(ipo.id, price);
          }
        } catch (e) {
          console.error(`Failed to refresh price for ${item.ticker}:`, e);
        }
      }
      await refreshData();
      alert("Fiyatlar guncellendi!");
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Grid - 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Toplam" value={totals.totalValue.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 })} icon={<DollarSign className="w-5 h-5" />} color="emerald" />
        <StatCard title="Nakit" value={totals.totalCash.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 })} icon={<DollarSign className="w-5 h-5" />} color="blue" />
        <StatCard title="Hisse" value={totals.totalStockValue.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 })} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
        <StatCard title="Kar/Zarar" value={totals.pnl.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 })} icon={totals.pnl >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />} color={totals.pnl >= 0 ? "emerald" : "rose"} />
      </div>

      {/* Action Buttons - Horizontal scroll on mobile */}
<div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <button
          onClick={() => setShowAddHoldingModal(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Ekle
        </button>
        <button
          onClick={() => setShowBulkPortfolioBuyModal(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap"
        >
          <ShoppingCart className="w-4 h-4" /> Toplu Al
        </button>
        <button
          onClick={() => setShowSellSelector(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap"
        >
          <TrendingDown className="w-4 h-4" /> Sat
        </button>
        <button
          onClick={refreshPrices}
          disabled={isRefreshingPrices}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border whitespace-nowrap ${
            isRefreshingPrices 
              ? "bg-zinc-800 border-zinc-700 text-zinc-500" 
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}
        >
          <RefreshCcw className={`w-4 h-4 ${isRefreshingPrices ? "animate-spin" : ""}`} />
          Fiyat
        </button>
      </div>

      {/* Portfolio Cards */}
      <div className="space-y-3">
        <h2 className="text-base font-bold opacity-80">Portfoy ({portfolioItems.length})</h2>
        
        {portfolioItems.map((item: any) => {
          const ipo = ipos.find((i: any) => i.id === item.ipoId) || ipos.find((i: any) => i.ticker?.toUpperCase() === item.ticker?.toUpperCase());
          return (
            <PortfolioCard
              key={item.ipoId || item.ticker}
              item={item}
              ipo={ipo}
              onSell={() => openSellForHolding(item)}
              isLoading={openingSellKey === String(item.ipoId || item.ticker)}
            />
          );
        })}

        {portfolioItems.length === 0 && (
          <div className="text-center py-10 text-zinc-500">
            <p className="font-medium">Portfoy bos</p>
            <p className="text-sm mt-1">Hisse eklemek icin yukaridaki butonlari kullan</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSellModal && activeSellTicker && (
          <SellDashboard
            participationId={activeSellParticipationId || activeSellTicker}
            ticker={activeSellTicker}
            accounts={accounts}
            participations={activeParticipations}
            onClose={() => setShowSellModal(false)}
            onSave={() => refreshData()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSellSelector && (
          <SellSelectorModal holdings={portfolioItems as any[]} ipos={ipos} onClose={() => setShowSellSelector(false)} onSelect={(h) => openSellForHolding(h)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddHoldingModal && user && (
          <AddHoldingModal userId={user.uid} accounts={accounts} ipos={ipos} onClose={() => setShowAddHoldingModal(false)} onSaved={() => refreshData()} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkPortfolioBuyModal && user && (
          <BulkPortfolioBuyModal userId={user.uid} accounts={accounts} ipos={ipos} onClose={() => setShowBulkPortfolioBuyModal(false)} onSaved={() => refreshData()} />
        )}
      </AnimatePresence>
    </div>
  );
}
