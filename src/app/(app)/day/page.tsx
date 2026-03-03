"use client";

import React, { useState, useMemo } from "react";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { processBatchOperation } from "@/lib/data-service";
import { Save, Check, Copy, ExternalLink } from "lucide-react";
import { getBankLoginUrl } from "@/constants/banks";

export default function DayTradingPage() {
  const { ipos, accounts, user, refreshData } = useFirebaseDataContext();
  const [selectedIpos, setSelectedIpos] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [batchLot, setBatchLot] = useState<number>(0);
  const [batchStatus, setBatchStatus] = useState<string>("Bekliyor");
  const [accountData, setAccountData] = useState<Record<string, Record<string, any>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const activeIpos = useMemo(() => {
    return (ipos || []).filter((ipo: any) => 
      ipo.status === "Talep Toplanıyor" || ipo.status === "Yolda"
    ).sort((a: any, b: any) => {
      const dateA = new Date(a.demandEndDate || 0).getTime();
      const dateB = new Date(b.demandEndDate || 0).getTime();
      return dateA - dateB;
    });
  }, [ipos]);

  const toggleIpo = (ipoId: string) => {
    setSelectedIpos(prev => 
      prev.includes(ipoId) ? prev.filter(id => id !== ipoId) : [...prev, ipoId]
    );
  };

  const toggleAllIpos = () => {
    if (selectedIpos.length === activeIpos.length) {
      setSelectedIpos([]);
    } else {
      setSelectedIpos(activeIpos.map((i: any) => i.id));
    }
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
    );
  };

  const toggleAllAccounts = () => {
    if (!accounts) return;
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map((a: any) => a.id));
    }
  };

  const applyBatchLot = () => {
    if (batchLot <= 0) return;
    
    setAccountData(prev => {
      const newData = { ...prev };
      selectedAccounts.forEach(accId => {
        if (!newData[accId]) newData[accId] = {};
        selectedIpos.forEach(ipoId => {
          newData[accId][ipoId] = {
            ...newData[accId][ipoId],
            requestedLots: batchLot,
            status: batchStatus,
            purchaseType: 'ipo',
          };
        });
      });
      return newData;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    if (selectedAccounts.length === 0 || selectedIpos.length === 0) {
      alert("Lütfen en az bir hesap ve bir halka arz seçin!");
      return;
    }

    setIsSaving(true);
    try {
      for (const accountId of selectedAccounts) {
        const account = accounts?.find((a: any) => a.id === accountId);
        if (!account) continue;

        for (const ipoId of selectedIpos) {
          const ipo = activeIpos.find((i: any) => i.id === ipoId);
          if (!ipo) continue;

          const data = accountData[accountId]?.[ipoId] || {};
          
          await processBatchOperation(
            user.uid,
            ipoId,
            ipo.price,
            [{
              id: accountId,
              requestedLots: data.requestedLots || 0,
              status: data.status || "Bekliyor",
              purchaseType: data.purchaseType || 'ipo',
              notes: data.notes || '',
              cashBalance: account.cashBalance || 0,
              originalRequestedLots: data.originalRequestedLots || 0,
              originalAllottedLots: 0
            }],
            'talep'
          );
        }
      }

      await refreshData();
      alert("Kaydedildi!");
    } catch (e) {
      console.error(e);
      alert("Kaydetme sırasında hata oluştu!");
    } finally {
      setIsSaving(false);
    }
  };

  const summary = useMemo(() => {
    let totalLots = 0;
    let totalCost = 0;

    selectedAccounts.forEach(accId => {
      selectedIpos.forEach(ipoId => {
        const data = accountData[accId]?.[ipoId];
        const ipo = activeIpos.find((i: any) => i.id === ipoId);
        
        if (data?.requestedLots > 0) {
          totalLots += data.requestedLots;
          totalCost += data.requestedLots * (ipo?.price || 0);
        }
      });
    });

    return { totalLots, totalCost };
  }, [selectedAccounts, selectedIpos, accountData, activeIpos]);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">İşlem Günü</h1>
          <p className="text-xs text-zinc-500 font-bold">
            {activeIpos.length} aktif arz, {accounts?.length || 0} hesap
          </p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
            isSaving 
              ? "bg-zinc-800 text-zinc-500" 
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Toplam Lot</p>
          <p className="text-lg font-black">{summary.totalLots}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-400 uppercase font-bold">Tahmini Tutar</p>
          <p className="text-lg font-black text-emerald-400">₺{summary.totalCost.toLocaleString()}</p>
        </div>
      </div>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black">AKTİF ARZLAR</h2>
          <button
            onClick={toggleAllIpos}
            className="text-xs text-emerald-400 font-bold"
          >
            {selectedIpos.length === activeIpos.length ? "Tümünü Kaldır" : "Tümünü Seç"}
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {activeIpos.map((ipo: any) => (
            <button
              key={ipo.id}
              onClick={() => toggleIpo(ipo.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                selectedIpos.includes(ipo.id)
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
              }`}
            >
              <span className="flex items-center gap-2">
                {selectedIpos.includes(ipo.id) && <Check className="w-3 h-3" />}
                {ipo.ticker} - ₺{Number(ipo.price || 0).toLocaleString()}
              </span>
            </button>
          ))}
          
          {activeIpos.length === 0 && (
            <p className="text-zinc-500 text-sm py-2">Aktif halka arz bulunmuyor</p>
          )}
        </div>
      </section>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4">
        <h2 className="text-sm font-black mb-3">TOPLU İŞLEM</h2>
        
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Lot"
            value={batchLot || ""}
            onChange={(e) => setBatchLot(Number(e.target.value))}
            className="flex-1 min-w-[100px] bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
          />
          
          <select
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
          >
            <option>Bekliyor</option>
            <option>Talepte</option>
            <option>Katılmadı</option>
          </select>

          <button
            onClick={applyBatchLot}
            disabled={batchLot <= 0 || selectedAccounts.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold text-white transition-colors"
          >
            Uygula
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black">HESAPLAR</h2>
          <button
            onClick={toggleAllAccounts}
            className="text-xs text-emerald-400 font-bold"
          >
            {selectedAccounts.length === (accounts?.length || 0) ? "Tümünü Kaldır" : "Tümünü Seç"}
          </button>
        </div>

        <div className="space-y-3">
          {accounts?.map((account: any) => (
            <div
              key={account.id}
              className={`bg-zinc-900/30 border rounded-2xl overflow-hidden transition-all ${
                selectedAccounts.includes(account.id)
                  ? "border-emerald-500/40"
                  : "border-zinc-800"
              }`}
            >
              <div 
                className="p-3 flex items-center justify-between cursor-pointer"
                onClick={() => toggleAccount(account.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedAccounts.includes(account.id)
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-zinc-600"
                  }`}>
                    {selectedAccounts.includes(account.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{account.ownerName || account.name}</p>
                    <p className="text-xs text-zinc-500">{account.bankName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.bankName && getBankLoginUrl(account.bankName.toLowerCase().replace(/[^a-z]/g, '')) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = getBankLoginUrl(account.bankName.toLowerCase().replace(/[^a-z]/g, ''));
                        if (url) window.open(url, '_blank');
                      }}
                      className="p-1.5 bg-green-500/10 text-green-400 rounded-lg"
                      title="Banka/Giriş"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  {account.brokerageUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(account.brokerageUrl, '_blank');
                      }}
                      className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg"
                      title="Hisse Senedi"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(account.accountNumber || "");
                    }}
                    className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg"
                    title="Hesap no"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(account.password || "");
                    }}
                    className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"
                    title="Şifre"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {selectedAccounts.includes(account.id) && (
                <div className="border-t border-zinc-800 p-3 bg-zinc-950/30">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {selectedIpos.map(ipoId => {
                      const ipo = activeIpos.find((i: any) => i.id === ipoId);
                      const data = accountData[account.id]?.[ipoId];
                      
                      return (
                        <div
                          key={ipoId}
                          className={`p-2 rounded-lg border transition-all ${
                            data?.requestedLots > 0
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : "bg-zinc-900 border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">{ipo?.ticker}</span>
                            <span className="text-[10px] text-zinc-500">₺{Number(ipo?.price || 0).toLocaleString()}</span>
                          </div>
                          
                          <input
                            type="number"
                            placeholder="Lot"
                            value={data?.requestedLots || ""}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAccountData(prev => ({
                                ...prev,
                                [account.id]: {
                                  ...prev[account.id],
                                  [ipoId]: {
                                    ...prev[account.id]?.[ipoId],
                                    requestedLots: val,
                                    status: val > 0 ? "Talepte" : "Bekliyor",
                                  }
                                }
                              }));
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="h-10" />
    </div>
  );
}
