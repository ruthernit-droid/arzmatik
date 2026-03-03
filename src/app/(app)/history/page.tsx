"use client";

import React, { useState, useMemo, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { Search, Filter, TrendingUp, TrendingDown, Calendar, RefreshCcw } from "lucide-react";

function money(n: number) {
  return Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " TL";
}

export default function HistoryPage() {
  const { accounts, ipos, user } = useFirebaseDataContext();
  const [isLoading, setIsLoading] = useState(false);
  const [participations, setParticipations] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const loadHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const all: any[] = [];
      for (const acc of accounts) {
        const pRef = collection(db, `users/${user.uid}/accounts/${acc.id}/participations`);
        const snap = await getDocs(pRef);
        snap.docs.forEach((d) => {
          const data = d.data();
          const ipo = ipos.find((i: any) => i.id === d.id) || ipos.find((i: any) => String(i.ticker || "").toUpperCase() === String(d.id || "").toUpperCase());
          all.push({
            id: d.id,
            accountId: acc.id,
            ownerName: acc.ownerName,
            bankName: acc.bankName,
            ticker: (ipo?.ticker || d.id) as string,
            ipoName: ipo?.name || "-",
            ...data,
          });
        });
      }

      all.sort((a, b) => {
        const ta = new Date(a.saleDate || a.updatedAt || 0).getTime();
        const tb = new Date(b.saleDate || b.updatedAt || 0).getTime();
        return tb - ta;
      });

      setParticipations(all);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user, accounts, ipos]);

  const filteredData = useMemo(() => {
    return participations.filter((p) => {
      const q = searchQ.toLowerCase();
      const matchSearch = !searchQ || 
        String(p.ticker || "").toLowerCase().includes(q) ||
        String(p.ipoName || "").toLowerCase().includes(q) ||
        String(p.ownerName || "").toLowerCase().includes(q);
      
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      
      let matchDate = true;
      if (dateFilter !== "all") {
        const pDate = new Date(p.updatedAt || 0);
        const now = new Date();
        if (dateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchDate = pDate >= weekAgo;
        } else if (dateFilter === "month") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchDate = pDate >= monthAgo;
        } else if (dateFilter === "3months") {
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          matchDate = pDate >= threeMonthsAgo;
        }
      }
      
      return matchSearch && matchStatus && matchDate;
    });
  }, [participations, searchQ, statusFilter, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const sold = filteredData.filter((p: any) => p.status === "Satıldı").length;
    const holding = filteredData.filter((p: any) => p.status === "Hissede").length;
    const cancelled = filteredData.filter((p: any) => p.status === "İptal" || p.status === "Katılmadı").length;
    
    const totalProfit = filteredData.reduce((sum: number, p: any) => {
      const revenue = Number(p.soldLotsTotal || 0) * Number(p.sellPrice || 0);
      const cost = Number(p.allottedLots || 0) * Number(p.lotPrice || 0);
      return sum + (revenue - cost);
    }, 0);

    return { total, sold, holding, cancelled, totalProfit };
  }, [filteredData]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(participations.map(p => p.status).filter(Boolean));
    return Array.from(statuses);
  }, [participations]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Gecmis</h1>
          <p className="text-zinc-500 font-bold text-sm">Tum katilimlarin geçmişi</p>
        </div>
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isLoading ? 'opacity-50 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}
        >
          <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Toplam</p>
          <p className="text-xl font-black">{stats.total}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Satildi</p>
          <p className="text-xl font-black text-emerald-400">{stats.sold}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Hissede</p>
          <p className="text-xl font-black text-blue-400">{stats.holding}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Kar/Zarar</p>
          <p className={`text-xl font-black ${stats.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{money(stats.totalProfit)}</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Hisse, hesap ara..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-emerald-500"
          >
            <option value="all">Tum Durumlar</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-emerald-500"
          >
            <option value="all">Tum Tarihler</option>
            <option value="week">Son 1 Hafta</option>
            <option value="month">Son 1 Ay</option>
            <option value="3months">Son 3 Ay</option>
          </select>
        </div>
      </div>

      <div className="bg-zinc-950/20 backdrop-blur-md rounded-[2.5rem] border border-zinc-800/50 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-900">
                <th className="p-4">Tarih</th>
                <th className="p-4">Hesap</th>
                <th className="p-4">Hisse</th>
                <th className="p-4">Lot</th>
                <th className="p-4">Fiyat</th>
                <th className="p-4">Satis</th>
                <th className="p-4">Kar/Zarar</th>
                <th className="p-4">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500 font-bold">
                    Veri bulunamadi
                  </td>
                </tr>
              ) : (
                filteredData.map((p, idx) => {
                  const cost = Number(p.allottedLots || 0) * Number(p.lotPrice || 0);
                  const revenue = Number(p.soldLotsTotal || 0) * Number(p.sellPrice || 0);
                  const profit = revenue - cost;
                  const isProfit = profit >= 0;
                  
                  return (
                    <tr key={`${p.accountId}_${p.id}_${idx}`} className="hover:bg-zinc-900/30 transition-all">
                      <td className="p-4 text-xs text-zinc-500 font-bold whitespace-nowrap">
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-bold text-white">{p.ownerName}</div>
                        <div className="text-zinc-500">{p.bankName}</div>
                      </td>
                      <td className="p-4 text-xs font-black text-white">{String(p.ticker || '').toUpperCase()}</td>
                      <td className="p-4 text-xs font-bold text-zinc-300">{Number(p.allottedLots || 0)}</td>
                      <td className="p-4 text-xs font-bold text-zinc-400">{Number(p.lotPrice || 0) ? `${Number(p.lotPrice).toLocaleString('tr-TR')} TL` : '-'}</td>
                      <td className="p-4 text-xs font-bold text-zinc-400">
                        {Number(p.sellPrice || 0) ? `${Number(p.sellPrice).toLocaleString('tr-TR')} TL` : '-'}
                      </td>
                      <td className={`p-4 text-xs font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {p.soldLotsTotal ? money(profit) : '-'}
                      </td>
                      <td className="p-4 text-xs font-bold">
                        <span className={`px-2 py-1 rounded-md ${
                          p.status === 'Satıldı' ? 'bg-emerald-500/20 text-emerald-400' :
                          p.status === 'Hissede' ? 'bg-blue-500/20 text-blue-400' :
                          p.status === 'İptal' || p.status === 'Katılmadı' ? 'bg-rose-500/20 text-rose-400' :
                          'bg-zinc-700/30 text-zinc-400'
                        }`}>
                          {p.status || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
