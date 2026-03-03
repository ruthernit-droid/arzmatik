"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Calculator, Copy, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { processBatchOperation, getParticipationsForIPO } from "@/lib/data-service";
import { auth } from "@/lib/firebase";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";

interface AccountOperationProps {
    account: any;
    onClose: () => void;
    onSave: () => void;
}

export default function AccountOperationPanel({ account, onClose, onSave }: AccountOperationProps) {
    const { ipos } = useFirebaseDataContext();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedIpos, setSelectedIpos] = useState<string[]>([]);
    const [availableIpos, setAvailableIpos] = useState<any[]>([]);
    const [accountData, setAccountData] = useState<any[]>([]);
    const [batchLot, setBatchLot] = useState<number>(0);
    const [batchStatus, setBatchStatus] = useState<string>("Talepte");
    const [batchType, setBatchType] = useState<'ipo' | 'portfolio'>('ipo');
    const [visiblePassword, setVisiblePassword] = useState(false);

    const ipoMap = new Map(ipos.map((i: any) => [i.id, i]));

    // Get available IPOS based on purchase type
    const activeStatus = ["Talep Toplanıyor", "Yolda"];
    const availableIposForH = ipos.filter((i: any) => activeStatus.includes(i.status));
    const availableIposForP = ipos.filter((i: any) => i.status === "Borsada İşlem Görüyor");
    const currentAvailableIpos = batchType === 'ipo' ? availableIposForH : availableIposForP;

    // Load available IPOS and their participation data
    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (userId && account.id) {
            // Load participation data for ALL IPOS to check existing entries
            Promise.all(ipos.map(async (ipo: any) => {
                const participations = await getParticipationsForIPO(userId, [account.id], ipo.id);
                return { ipoId: ipo.id, participation: participations[0] || null };
            })).then(results => {
                // Show if: has participation OR (H mode: active) OR (P mode: in stock market)
                const mappedData = results
                    .filter(r => {
                        const ipo = ipoMap.get(r.ipoId);
                        const hasParticipation = r.participation && (r.participation.requestedLots > 0 || r.participation.status);
                        const isActive = ipo && activeStatus.includes(ipo.status);
                        const isStock = ipo && ipo.status === "Borsada İşlem Görüyor";
                        
                        if (batchType === 'portfolio') {
                            // Portfolio: show stocks with participation OR in stock market
                            return hasParticipation || isStock;
                        } else {
                            // IPO: show with participation OR active
                            return hasParticipation || isActive;
                        }
                    })
                    .map(r => {
                        const ipo = ipoMap.get(r.ipoId);
                        const p = r.participation || {};
                        return {
                            ipoId: r.ipoId,
                            companyName: ipo?.companyName || 'Bilinmiyor',
                            ticker: ipo?.ticker || '-',
                            price: ipo?.price || 0,
                            isActive: ipo ? activeStatus.includes(ipo.status) : false,
                            isStock: ipo ? ipo.status === "Borsada İşlem Görüyor" : false,
                            requestedLots: p.requestedLots || 0,
                            originalRequestedLots: p.requestedLots || 0,
                            status: p.status || (ipo && activeStatus.includes(ipo.status) ? 'Bekliyor' : ''),
                            purchaseType: p.purchaseType || 'ipo',
                            notes: p.notes || '',
                        };
                    })
                    .sort((a, b) => (a.companyName || "").localeCompare(b.companyName || ""));

                setAccountData(mappedData);
                
                // Auto-select those with existing participation
                const existingIds = mappedData.filter(d => d.requestedLots > 0).map(d => d.ipoId);
                setSelectedIpos(existingIds);
            });
        }
    }, [account.id, ipos, batchType]);

    // Filter displayed IPOS based on selection
    const displayedData = accountData.filter(d => selectedIpos.includes(d.ipoId));

    const toggleIpo = (id: string) => {
        setSelectedIpos(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const applyBatchRequest = () => {
        setAccountData(prev => prev.map(acc => {
            if (selectedIpos.includes(acc.ipoId)) {
                return { ...acc, requestedLots: batchLot, status: batchStatus, purchaseType: batchType };
            }
            return acc;
        }));
    };

    const toggleAll = () => {
        if (selectedIpos.length === accountData.length) setSelectedIpos([]);
        else setSelectedIpos(accountData.map((i: any) => i.ipoId));
    };

    const handleSave = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Filter entries that have lot requests
        const toSave = accountData.filter(a => a.requestedLots > 0);
        
        if (toSave.length === 0) {
            alert("En az bir halka arz için lot girişi yapmalısınız!");
            return;
        }

        if (toSave.some(a => a.requestedLots < 0)) {
            alert("Lütfen geçerli bir lot miktarı giriniz!");
            return;
        }

        setIsSaving(true);
        try {
            // Save each IPO participation individually
            for (const item of toSave) {
                await processBatchOperation(userId, item.ipoId, item.price, [{
                    id: account.id,
                    requestedLots: item.requestedLots,
                    status: item.status,
                    purchaseType: item.purchaseType,
                    notes: item.notes,
                    cashBalance: account.cashBalance,
                    originalRequestedLots: item.originalRequestedLots,
                    originalAllottedLots: 0
                }], 'talep');
            }
            
            onSave();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Kaydetme sırasında bir hata oluştu!");
        } finally {
            setIsSaving(false);
        }
    };

    const copyPassword = () => {
        if (account.password) {
            navigator.clipboard.writeText(account.password);
            alert("Parola kopyalandı!");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
            <div className="w-full max-w-7xl h-[90vh] glass-card flex flex-col bg-zinc-950 border-emerald-500/20 shadow-2xl overflow-hidden !p-0">
                {/* Header */}
                <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            Hesap Operasyonu: <span className="text-emerald-400">{account.ownerName}</span>
                        </h2>
                        <p className="text-zinc-500 text-sm flex items-center gap-3">
                            <span className="font-mono">{account.accountNumber}</span>
                            <span className="w-px h-4 bg-zinc-800"></span>
                            <span className="text-emerald-400 font-bold">{(account.cashBalance || 0).toLocaleString('tr-TR')} TL</span>
                        </p>
                    </div>
                    
                    <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* IPO Selection */}
                <div className="p-4 bg-zinc-900/20 border-b border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
                            {batchType === 'portfolio' ? 'Hisse Sec:' : 'Halka Arz Sec:'}
                        </span>
                        <button 
                            onClick={() => setSelectedIpos(currentAvailableIpos.map((i: any) => i.id))}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold"
                        >
                            Tumunu Sec
                        </button>
                        <button 
                            onClick={() => setSelectedIpos([])}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold"
                        >
                            Temizle
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {currentAvailableIpos.map((ipo: any) => (
                            <button
                                key={ipo.id}
                                onClick={() => {
                                    if (selectedIpos.includes(ipo.id)) {
                                        setSelectedIpos(selectedIpos.filter(id => id !== ipo.id));
                                    } else {
                                        setSelectedIpos([...selectedIpos, ipo.id]);
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${
                                    selectedIpos.includes(ipo.id) 
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                                }`}
                            >
                                <span className={`w-3 h-3 rounded border flex items-center justify-center ${
                                    selectedIpos.includes(ipo.id) ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
                                }`}>
                                    {selectedIpos.includes(ipo.id) && <span className="text-[8px] text-black">✓</span>}
                                </span>
                                {ipo.ticker}
                            </button>
                        ))}
                        {availableIpos.length === 0 && (
                            <span className="text-zinc-500 text-sm">Aktif halka arz bulunmuyor.</span>
                        )}
                    </div>
                </div>

                {/* Batch Toolbar */}
                <div className="p-4 bg-zinc-900/40 border-b border-zinc-900 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
                            <Calculator className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-sm font-bold text-zinc-300">Toplu Talep:</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            placeholder="Lot"
                            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm w-28 focus:border-emerald-500 transition-all outline-none"
                            value={batchLot}
                            onChange={(e) => setBatchLot(Number(e.target.value))}
                        />
                        <button
                            onClick={applyBatchRequest}
                            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-emerald-500 border border-emerald-500/20 transition-all font-bold text-sm"
                        >
                            Uygula <ArrowRight className="inline w-4 h-4 ml-1" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={batchStatus}
                            onChange={(e) => setBatchStatus(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500 transition-all"
                        >
                            <option>Talepte</option>
                            <option>İptal</option>
                            <option>Giriş Yapılamıyor</option>
                            <option>Ulaşılamıyor</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest font-black">Alım Türü:</span>
                        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                            <button onClick={() => setBatchType('ipo')} className={`px-3 py-1 rounded text-[10px] font-black transition-all ${batchType === 'ipo' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}>H (ARZ)</button>
                            <button onClick={() => setBatchType('portfolio')} className={`px-3 py-1 rounded text-[10px] font-black transition-all ${batchType === 'portfolio' ? 'bg-blue-500 text-white' : 'text-zinc-500'}`}>P (PORTFÖY)</button>
                        </div>
                    </div>

                    <div className="flex-1" />

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-6 py-2 text-white text-sm font-black rounded-xl transition-all shadow-lg flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950'}`}
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto bg-zinc-950">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur border-b border-zinc-900 z-10">
                            <tr className="text-zinc-500 text-xs uppercase tracking-widest font-black">
                                <th className="p-4 w-12">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIpos.length === accountData.length && accountData.length > 0} 
                                        onChange={toggleAll} 
                                        className="w-4 h-4 rounded-md accent-emerald-500 cursor-pointer" 
                                    />
                                </th>
                                <th className="p-4">Halka Arz</th>
                                <th className="p-4">Sembol</th>
                                <th className="p-4 text-right">Fiyat</th>
                                <th className="p-4 text-right border-l border-zinc-900/50">Talep (Lot)</th>
                                <th className="p-4">Durum</th>
                                <th className="p-4 text-right">Maliyet</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                            {accountData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                                        Aktif halka arz bulunmuyor.
                                    </td>
                                </tr>
                            )}
                            {displayedData.map((acc) => {
                                const isSelected = selectedIpos.includes(acc.ipoId);
                                const cost = (acc.requestedLots || 0) * acc.price;

                                return (
                                    <tr
                                        key={acc.ipoId}
                                        className={`group border-l-2 transition-all ${isSelected ? 'bg-emerald-500/5 border-emerald-500/50' : 'hover:bg-zinc-900/30 border-transparent'}`}
                                    >
                                        <td className="p-4">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected} 
                                                onChange={() => toggleIpo(acc.ipoId)} 
                                                className="w-4 h-4 rounded-md cursor-pointer accent-emerald-500" 
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-zinc-100 whitespace-nowrap">{acc.companyName}</td>
                                        <td className="p-4 text-zinc-400 font-mono text-sm">{acc.ticker}</td>
                                        <td className="p-4 text-right text-zinc-300 font-mono">₺{Number(acc.price || 0).toLocaleString('tr-TR')}</td>
                                        
                                        <td className="p-4 text-right border-l border-zinc-900/50">
                                            <input
                                                type="number"
                                                value={acc.requestedLots}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setAccountData(prev => prev.map(a => a.ipoId === acc.ipoId ? { ...a, requestedLots: val } : a));
                                                }}
                                                className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1.5 text-right w-24 outline-none focus:border-emerald-500 text-emerald-100"
                                            />
                                        </td>

                                        <td className="p-4">
                                            <select
                                                value={acc.status}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAccountData(prev => prev.map(a => a.ipoId === acc.ipoId ? { ...a, status: val } : a));
                                                }}
                                                className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none focus:border-emerald-500 transition-all font-bold text-zinc-400"
                                            >
                                                <option>Bekliyor</option>
                                                <option>Talepte</option>
                                                <option>Giriş Yapılamıyor</option>
                                                <option>Ulaşılamıyor</option>
                                                <option>Dağıtıldı</option>
                                                <option>İptal</option>
                                            </select>
                                        </td>
                                        
                                        <td className="p-4 text-right font-mono text-sm border-l border-zinc-900/50">
                                            <div className="text-amber-400">-{cost.toLocaleString('tr-TR')} ₺</div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
}
