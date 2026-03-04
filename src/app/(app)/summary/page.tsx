"use client";

import React, { useMemo, useState } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, setDoc } from "firebase/firestore";
import { RefreshCcw, X, TrendingUp, TrendingDown, Wallet, PiggyBank, Plus, Minus, Edit, ArrowUpRight, ArrowDownRight } from "lucide-react";

import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { db } from "@/lib/firebase";
import PieChart from "@/components/charts/PieChart";
import StatCard from "@/components/ui/StatCard";

function money(n: number) {
  return Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " TL";
}

function moneyWithDecimals(n: number) {
  return Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
}

export default function SummaryPage() {
  const { accounts, ipos, portfolioItems, user } = useFirebaseDataContext();

  const totals = useMemo(() => {
    const totalCash = accounts.reduce((sum, a: any) => sum + Number(a.cashBalance || 0), 0);
    const totalCost = portfolioItems.reduce((sum: number, i: any) => sum + Number(i.totalCost || 0), 0);
    const totalStockValue = portfolioItems.reduce((sum: number, i: any) => {
      const ipo = ipos.find((x: any) => x.id === i.ipoId) || ipos.find((x: any) => String(x.ticker || "").toUpperCase() === String(i.ticker || "").toUpperCase());
      return sum + Number(i.totalLots || 0) * Number(ipo?.price || 0);
    }, 0);
    const totalValue = totalCash + totalStockValue;
    const pnl = totalStockValue - totalCost;
    
    const totalInvested = accounts.reduce((sum, a: any) => sum + Number(a.demand || 0), 0);
    const activeIposCount = ipos.filter((i: any) => {
      const s = String(i.status || "").toLowerCase();
      return s.includes("talep") || s.includes("basvuru");
    }).length;
    
    return { totalCash, totalCost, totalStockValue, totalValue, pnl, totalInvested, activeIposCount };
  }, [accounts, ipos, portfolioItems]);

  // Grafik verileri
  const pieData = useMemo(() => {
    return [
      { label: "Nakit", value: totals.totalCash, color: "#10b981" },
      { label: "Hisse", value: totals.totalStockValue, color: "#3b82f6" },
    ];
  }, [totals]);

  // Durum bazlı veriler
  const statusData = useMemo(() => {
    const active = accounts.filter((a: any) => a.isActive).length;
    const passive = accounts.length - active;
    return [
      { label: "Aktif", value: active, color: "#10b981" },
      { label: "Pasif", value: passive, color: "#71717a" },
    ];
  }, [accounts]);

  const [isLoadingMoves, setIsLoadingMoves] = useState(false);
  const [moves, setMoves] = useState<any[]>([]);

  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [actionMode, setActionMode] = useState<'none' | 'fix' | 'add' | 'sell' | 'cash'>('none');
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  const handleCashAdjustment = async (amount: number) => {
    if (!user || !selectedAccount) return;
    if (!confirm(`${amount > 0 ? 'Ekleme' : 'Çıkarma'} yapmak istediğinize emin misiniz?\nTutar: ${Math.abs(amount)} TL`)) return;
    
    try {
      const accRef = doc(db, `users/${user.uid}/accounts/${selectedAccount.id}`);
      await updateDoc(accRef, {
        cashBalance: (selectedAccount.cashBalance || 0) + amount
      });
      alert("Bakiye güncellendi!");
      setSelectedAccount({ ...selectedAccount, cashBalance: (selectedAccount.cashBalance || 0) + amount });
    } catch (e) {
      alert("Hata: " + e);
    }
  };

  const handleAddStock = async () => {
    if (!user || !selectedAccount) return;
    const ticker = prompt("Hisse kodu (örn: THYAO):");
    if (!ticker) return;
    const lots = Number(prompt("Lot sayısı:"));
    if (!lots || lots <= 0) return;
    const price = Number(prompt("Alış fiyatı:"));
    if (!price || price <= 0) return;

    try {
      const pRef = doc(db, `users/${user.uid}/accounts/${selectedAccount.id}/participations/${ticker.toUpperCase()}`);
      await setDoc(pRef, {
        ticker: ticker.toUpperCase(),
        allottedLots: lots,
        lotPrice: price,
        purchaseType: 'portfolio',
        status: 'Hissede',
        requestedLots: 0,
        createdAt: new Date().toISOString()
      });
      const accRef = doc(db, `users/${user.uid}/accounts/${selectedAccount.id}`);
      await updateDoc(accRef, {
        cashBalance: (selectedAccount.cashBalance || 0) - (lots * price)
      });
      alert("Hisse eklendi!");
      openAccountDetail(selectedAccount);
    } catch (e) {
      alert("Hata: " + e);
    }
  };

  const handleFixLot = async (row: any, newLots: number) => {
    if (!user || !selectedAccount) return;
    if (!confirm(`Lot düzeltmek istediğinize emin misiniz?\n${row.ticker}: ${row.allottedLots} -> ${newLots}`)) return;

    try {
      const pRef = doc(db, `users/${user.uid}/accounts/${selectedAccount.id}/participations/${row.id}`);
      await updateDoc(pRef, {
        allottedLots: newLots,
        updatedAt: new Date().toISOString()
      });
      alert("Lot düzeltildi!");
      openAccountDetail(selectedAccount);
    } catch (e) {
      alert("Hata: " + e);
    }
  };

  const refreshPrices = async () => {
    setIsRefreshingPrices(true);
    try {
      // This would ideally call an API, but for now we'll just reload
      if (confirm("Fiyatları güncellemek için sayfayı yenilemek gerekiyor. Devam etmek istiyor musunuz?")) {
        window.location.reload();
      }
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  const openAccountDetail = async (acc: any) => {
    if (!user) return;
    setSelectedAccount(acc);
    setDetailLoading(true);
    try {
      const pRef = collection(db, `users/${user.uid}/accounts/${acc.id}/participations`);
      const snap = await getDocs(pRef);
      const rows = snap.docs.map((d) => {
        const data: any = d.data();
        const ipo = ipos.find((i: any) => i.id === d.id) || ipos.find((i: any) => String(i.ticker || "").toUpperCase() === String(d.id || "").toUpperCase());
        const ticker = String(ipo?.ticker || d.id || "").toUpperCase();
        const currentPrice = Number(ipo?.price || 0);
        const lotPrice = Number(data.lotPrice || 0);
        const lots = Number(data.allottedLots || 0);
        const marketValue = lots * currentPrice;
        const cost = lots * lotPrice;
        const pnl = marketValue - cost;
        const up10 = lots * (currentPrice * 1.1) - cost;
        const down10 = lots * (currentPrice * 0.9) - cost;
        return {
          id: d.id,
          ticker,
          status: data.status || "-",
          purchaseType: data.purchaseType || "ipo",
          requestedLots: Number(data.requestedLots || 0),
          allottedLots: lots,
          soldLotsTotal: Number(data.soldLotsTotal || 0),
          lotPrice,
          currentPrice,
          marketValue,
          cost,
          pnl,
          up10,
          down10,
          sellPrice: Number(data.sellPrice || 0),
          saleDate: data.saleDate || null,
          updatedAt: data.updatedAt || null,
        };
      });
      rows.sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
      setDetailRows(rows);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadMoves = async () => {
    if (!user) return;
    setIsLoadingMoves(true);
    try {
      const all: any[] = [];
      for (const acc of accounts) {
        const pRef = collection(db, `users/${user.uid}/accounts/${acc.id}/participations`);
        const snap = await getDocs(pRef);
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          all.push({
            accountId: acc.id,
            ownerName: acc.ownerName,
            bankName: acc.bankName,
            participationId: d.id,
            ticker: (ipos.find((x: any) => x.id === d.id)?.ticker || d.id) as string,
            ...data,
          });
        });
      }

      all.sort((a, b) => {
        const ta = new Date(a.saleDate || a.updatedAt || 0).getTime();
        const tb = new Date(b.saleDate || b.updatedAt || 0).getTime();
        return tb - ta;
      });

      setMoves(all.slice(0, 200));
    } finally {
      setIsLoadingMoves(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black">Ozet</h1>
        <p className="text-zinc-500 font-bold text-sm">Tum hesaplarin nakit/hisse durumunu ve son islemleri gor.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Toplam Varlik</p>
          <p className="text-xl font-black">{money(totals.totalValue)}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Toplam Nakit</p>
          <p className="text-xl font-black">{money(totals.totalCash)}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Hisse Degeri</p>
          <p className="text-xl font-black">{money(totals.totalStockValue)}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Kar/Zarar</p>
          <p className={`text-xl font-black ${totals.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(totals.pnl)}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Aktif Arz</p>
          <p className="text-xl font-black text-amber-400">{totals.activeIposCount}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Hesap Sayisi</p>
          <p className="text-xl font-black">{accounts.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
          <h3 className="text-sm font-black text-zinc-400 mb-4">Portfoy Dagilimi</h3>
          <div className="flex justify-center">
            <PieChart data={pieData} size={180} />
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
          <h3 className="text-sm font-black text-zinc-400 mb-4">Hesap Durumu</h3>
          <div className="flex justify-center">
            <PieChart data={statusData} size={180} />
          </div>
        </div>
      </div>

      <div className="bg-zinc-950/20 backdrop-blur-md rounded-[2.5rem] border border-zinc-800/50 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-900">
          <h2 className="text-lg font-black">Hesap Ozeti (Detay icin satira tikla)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-900">
                <th className="p-4">Hesap</th>
                <th className="p-4">Nakit</th>
                <th className="p-4">Talep</th>
                <th className="p-4">Hisse</th>
                <th className="p-4">Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {accounts.map((a: any) => (
                <tr key={a.id} className="hover:bg-zinc-900/30 transition-all cursor-pointer" onClick={() => openAccountDetail(a)}>
                  <td className="p-4">
                    <div className="text-sm font-black text-white">{a.ownerName}</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{a.bankName}</div>
                  </td>
                  <td className="p-4 text-sm font-black text-emerald-400">{money(a.cashBalance || 0)}</td>
                  <td className="p-4 text-sm font-black text-amber-400">{money(a.demand || 0)}</td>
                  <td className="p-4 text-sm font-black text-blue-300">{money(a.stocks || 0)}</td>
                  <td className="p-4 text-sm font-black">{money((a.cashBalance || 0) + (a.stocks || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-zinc-950/20 backdrop-blur-md rounded-[2.5rem] border border-zinc-800/50 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
          <h2 className="text-lg font-black">Son Hareketler</h2>
          <button
            onClick={loadMoves}
            disabled={isLoadingMoves}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${isLoadingMoves ? 'opacity-50 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}
          >
            <RefreshCcw className={`w-4 h-4 ${isLoadingMoves ? 'animate-spin' : ''}`} />
            Yukle
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-900">
                <th className="p-4">Tarih</th>
                <th className="p-4">Hesap</th>
                <th className="p-4">Hisse</th>
                <th className="p-4">Tur</th>
                <th className="p-4">Lot</th>
                <th className="p-4">Alim</th>
                <th className="p-4">Satis</th>
                <th className="p-4">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {moves.map((m) => (
                <tr key={`${m.accountId}_${m.participationId}`} className="hover:bg-zinc-900/30 transition-all">
                  <td className="p-4 text-xs text-zinc-500 font-bold">{new Date(m.saleDate || m.updatedAt || 0).toLocaleString('tr-TR')}</td>
                  <td className="p-4 text-xs font-bold text-white">{m.ownerName}</td>
                  <td className="p-4 text-xs font-black text-white">{String(m.ticker || '').toUpperCase()}</td>
                  <td className="p-4 text-xs font-black"><span className={`${m.purchaseType === 'ipo' ? 'text-amber-400' : 'text-blue-300'}`}>{m.purchaseType === 'ipo' ? 'H' : 'P'}</span></td>
                  <td className="p-4 text-xs font-black text-zinc-300">{Number(m.allottedLots || 0)}</td>
                  <td className="p-4 text-xs font-black text-zinc-400">{Number(m.lotPrice || 0) ? `${Number(m.lotPrice).toLocaleString('tr-TR')} TL` : '-'}</td>
                  <td className="p-4 text-xs font-black text-zinc-400">{Number(m.sellPrice || 0) ? `${Number(m.sellPrice).toLocaleString('tr-TR')} TL` : '-'}</td>
                  <td className="p-4 text-xs font-black text-zinc-400">{m.status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAccount && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col">
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white">{selectedAccount.ownerName} - Hesap Detayi</h3>
                <p className="text-xs text-zinc-500 font-bold">{selectedAccount.bankName} | Nakit: {money(selectedAccount.cashBalance || 0)}</p>
              </div>
              <button onClick={() => setSelectedAccount(null)} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-b border-zinc-900 bg-zinc-900/30 flex flex-wrap gap-2">
              <button onClick={refreshPrices} disabled={isRefreshingPrices} className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center gap-1">
                <RefreshCcw className={`w-3 h-3 ${isRefreshingPrices ? 'animate-spin' : ''}`} /> Fiyatlari Yenile
              </button>
              <button onClick={handleAddStock} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Hisse Ekle
              </button>
              <button onClick={() => {
                const amount = Number(prompt("Eklenecek tutar (TL):", "0"));
                if (amount > 0) handleCashAdjustment(amount);
              }} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Para Ekle
              </button>
              <button onClick={() => {
                const amount = Number(prompt("Cikarilacak tutar (TL):", "0"));
                if (amount > 0) handleCashAdjustment(-amount);
              }} className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1">
                <Minus className="w-3 h-3" /> Para Cikart
              </button>
            </div>

            <div className="p-6 overflow-auto">
              {detailLoading ? (
                <div className="p-8 text-center text-zinc-500 font-bold">Yukleniyor...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Hissede Deger</div>
                      <div className="text-lg font-black text-emerald-400">{money(detailRows.reduce((s, r) => s + r.marketValue, 0))}</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Maliyet</div>
                      <div className="text-lg font-black text-zinc-300">{money(detailRows.reduce((s, r) => s + r.cost, 0))}</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Anlik Kar/Zarar</div>
                      <div className={`text-lg font-black ${detailRows.reduce((s, r) => s + r.pnl, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{money(detailRows.reduce((s, r) => s + r.pnl, 0))}</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Senaryo (+10% / -10%)</div>
                      <div className="text-xs font-black text-emerald-400">+10%: {money(detailRows.reduce((s, r) => s + r.up10, 0))}</div>
                      <div className="text-xs font-black text-rose-400">-10%: {money(detailRows.reduce((s, r) => s + r.down10, 0))}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-900">
                          <th className="p-4">Hisse</th>
                          <th className="p-4">Tur</th>
                          <th className="p-4">Talep</th>
                          <th className="p-4">Lot</th>
                          <th className="p-4">Maliyet</th>
                          <th className="p-4">Anlik</th>
                          <th className="p-4">Kar/Zarar</th>
                          <th className="p-4">Durum</th>
                          <th className="p-4">Islem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {detailRows.map((r) => (
                          <tr key={r.id} className="hover:bg-zinc-900/20 transition-all">
                            <td className="p-4 text-sm font-black text-white">{r.ticker}</td>
                            <td className="p-4 text-xs font-black"><span className={`${r.purchaseType === 'ipo' ? 'text-amber-400' : 'text-blue-300'}`}>{r.purchaseType === 'ipo' ? 'H' : 'P'}</span></td>
                            <td className="p-4 text-xs text-zinc-400 font-bold">{r.requestedLots}</td>
                            <td className="p-4 text-xs text-zinc-200 font-black">{r.allottedLots}</td>
                            <td className="p-4 text-xs text-zinc-400 font-bold">{r.lotPrice ? `${Number(r.lotPrice).toLocaleString('tr-TR')} TL` : '-'}</td>
                            <td className="p-4 text-xs text-zinc-400 font-bold">{r.currentPrice ? `${Number(r.currentPrice).toLocaleString('tr-TR')} TL` : '-'}</td>
                            <td className={`p-4 text-xs font-black ${r.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{money(r.pnl)}</td>
                            <td className="p-4 text-xs text-zinc-400 font-bold">{r.status}</td>
                            <td className="p-4">
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => {
                                    const newLots = Number(prompt("Yeni lot sayısı:", String(r.allottedLots)));
                                    if (newLots >= 0) handleFixLot(r, newLots);
                                  }}
                                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400" title="Lot Düzelt"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => {
                                    const sellPrice = Number(prompt("Satış fiyatı:", String(r.currentPrice)));
                                    const sellLots = Number(prompt("Satılacak lot:", String(r.allottedLots)));
                                    if (sellPrice > 0 && sellLots > 0) {
                                      // Simple sell logic
                                      handleCashAdjustment(sellLots * sellPrice);
                                      handleFixLot(r, r.allottedLots - sellLots);
                                    }
                                  }}
                                  className="p-1 rounded bg-rose-900/30 hover:bg-rose-900/50 text-rose-400" title="Sat"
                                >
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
