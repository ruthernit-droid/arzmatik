"use client";

import React, { useState } from "react";
import {
    X,
    Save,
    Users,
    ArrowRight,
    Calculator,
    BarChart3,
    Copy,
    ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";
import { getParticipationsForIPO } from "@/lib/data-service";
import { auth } from "@/lib/firebase";

interface OperationProps {
    ipo: { id: string; name: string; price: number; totalOfferedLots?: number };
    accounts: any[];
    participations?: any[]; // Expected to contain previously saved participations, mapping accountId -> { requestedLots, allottedLots }
    initialMode?: 'talep' | 'dagitim';
    onClose: () => void;
    onSave: (data: any, mode: 'talep' | 'dagitim') => void;
}

export default function OperationDashboard({ ipo, accounts, participations = [], initialMode = 'talep', onClose, onSave }: OperationProps) {
    const [mode, setMode] = useState<'talep' | 'dagitim'>(initialMode);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [batchLot, setBatchLot] = useState<number>(0);
    const [maxAllottedLot, setMaxAllottedLot] = useState<number>(0);
    const [batchStatus, setBatchStatus] = useState<string>("Talepte");
    const [batchType, setBatchType] = useState<'ipo' | 'portfolio'>('ipo');
    const [isSaving, setIsSaving] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
    const [showScenario, setShowScenario] = useState(false);

    const scenarioApplicants = [300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1150000, 1300000];
    const scenarioRows = scenarioApplicants.map((applicants) => {
        const offered = Number(ipo.totalOfferedLots || 0);
        const perAccount = applicants > 0 ? Math.floor(offered / applicants) : 0;
        return { applicants, perAccount };
    });

    const togglePasswordVisibility = (id: string, password?: string) => {
        const newVisible = new Set(visiblePasswords);
        if (newVisible.has(id)) {
            newVisible.delete(id);
        } else {
            newVisible.add(id);
            if (password) copyToClipboard(password);
        }
        setVisiblePasswords(newVisible);
    };

    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        // Using a simple alert for now as toast system is not defined, 
        // but it's enough for UX to know it worked.
        // Actually I'll use a local state or just trust the visual feedback?
        // Let's just do a tiny 'copied' notification using a temporary state if possible
    };

    // Initialize state with previous participations if available
    // Guard: Ensure accounts is valid array to prevent crash on .map()
    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const [accountData, setAccountData] = useState<any[]>(safeAccounts.map(a => {
        const p = participations?.find(p => p.accountId === a.id) || {};
        return {
            ...a,
            requestedLots: p.requestedLots || 0,
            allottedLots: p.allottedLots || 0,
            originalRequestedLots: p.requestedLots || 0,
            originalAllottedLots: p.allottedLots || 0,
            status: p.status || 'Talepte',
            purchaseType: p.purchaseType || 'ipo',
            notes: p.notes || ''
        };
    }));

    React.useEffect(() => {
        const userId = auth.currentUser?.uid;
        
        // Guard: Ensure accounts is valid array
        const safeAccounts = Array.isArray(accounts) ? accounts : [];
        
        if (userId && ipo.id && safeAccounts.length > 0) {
            getParticipationsForIPO(userId, safeAccounts.map(a => a.id), ipo.id)
                .then(fetchedParticipations => {
                    setAccountData(safeAccounts.map(a => {
                        const p = fetchedParticipations.find((p: any) => p.accountId === a.id) || {};
                        return {
                            ...a,
                            requestedLots: p.requestedLots || 0,
                            allottedLots: p.allottedLots || 0,
                            originalRequestedLots: p.requestedLots || 0,
                            originalAllottedLots: p.allottedLots || 0,
                            status: p.status || 'Talepte',
                            purchaseType: p.purchaseType || 'ipo',
                            notes: p.notes || ''
                        };
                    }));
                })
                .catch(err => {
                    console.error("Failed to load participations:", err);
                    // Fallback to empty state if fetch fails
                    setAccountData(safeAccounts.map(a => ({
                        ...a,
                        requestedLots: 0,
                        allottedLots: 0,
                        originalRequestedLots: 0,
                        originalAllottedLots: 0,
                        status: 'Talepte',
                        purchaseType: 'ipo',
                        notes: ''
                    })));
                });
        } else {
            // Initialize with safe empty state if prerequisites fail
            setAccountData(safeAccounts.map(a => ({
                ...a,
                requestedLots: 0,
                allottedLots: 0,
                originalRequestedLots: 0,
                originalAllottedLots: 0,
                status: 'Talepte',
                purchaseType: 'ipo',
                notes: ''
            })));
        }
    }, [ipo.id, accounts]);

    const toggleAll = () => {
        if (selectedAccounts.length === safeAccounts.length) setSelectedAccounts([]);
        else setSelectedAccounts(safeAccounts.map(a => a.id));
    };

    const toggleAccount = (id: string) => {
        setSelectedAccounts(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const applyBatchRequest = () => {
        setAccountData(prev => prev.map(acc => {
            if (selectedAccounts.includes(acc.id)) {
                return { ...acc, requestedLots: batchLot, status: batchStatus, purchaseType: batchType };
            }
            return acc;
        }));
    };

    const applyMaxDistribution = () => {
        setAccountData(prev => prev.map(acc => {
            if (selectedAccounts.includes(acc.id)) {
                const allotted = Math.min(acc.requestedLots, maxAllottedLot);
                return { ...acc, allottedLots: allotted, status: "Dağıtıldı" };
            }
            return acc;
        }));
    };

    // Sorted accounts: Priority to those needing action
    const sortedAccountData = [...accountData].sort((a, b) => {
        const problemStatuses = new Set(["Giriş Yapılamıyor", "Ulaşılamıyor"]);
        const aProblem = problemStatuses.has(a.status);
        const bProblem = problemStatuses.has(b.status);

        const aSaved = mode === 'talep' ? (Number(a.originalRequestedLots || 0) > 0) : (Number(a.originalAllottedLots || 0) > 0);
        const bSaved = mode === 'talep' ? (Number(b.originalRequestedLots || 0) > 0) : (Number(b.originalAllottedLots || 0) > 0);

        const aRank = aProblem ? 1 : (aSaved ? 2 : 0);
        const bRank = bProblem ? 1 : (bSaved ? 2 : 0);
        if (aRank !== bRank) return aRank - bRank;
        return (a.ownerName || "").localeCompare(b.ownerName || "");
    });

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
                            Operasyon: <span className="text-emerald-400">{ipo.name}</span>
                            <span className="text-sm px-3 py-1 bg-zinc-800 rounded-lg text-emerald-400 font-mono font-bold">
                                ₺{Number(ipo.price || 0).toFixed(2)}/Lot
                            </span>
                        </h2>
                        <p className="text-zinc-500 text-sm">Halka arz için talep toplayın veya dağıtım sonuçlarını girin.</p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                        <button
                            onClick={() => setMode('talep')}
                            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${mode === 'talep' ? 'bg-emerald-500 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <BarChart3 className="w-4 h-4" /> Talep Girişi
                        </button>
                        <button
                            onClick={() => setMode('dagitim')}
                            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${mode === 'dagitim' ? 'bg-blue-500 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <Calculator className="w-4 h-4" /> Sonuç Dağıtımı
                        </button>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Batch Operations Toolbar */}
                <div className="p-4 bg-zinc-900/40 border-b border-zinc-900 flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg border ${mode === 'talep' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                            <Users className={`w-4 h-4 ${mode === 'talep' ? 'text-emerald-400' : 'text-blue-400'}`} />
                        </div>
                        <span className="text-sm font-bold text-zinc-300">
                            {mode === 'talep' ? 'Toplu Talep:' : 'Toplu Dağıtım:'}
                        </span>
                    </div>

                    {mode === 'talep' ? (
                        <>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    placeholder="Lot (Örn: 200)"
                                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm w-36 focus:border-emerald-500 transition-all outline-none"
                                    value={batchLot}
                                    onChange={(e) => setBatchLot(Number(e.target.value))}
                                />
                                <button
                                    onClick={applyBatchRequest}
                                    className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-emerald-500 border border-emerald-500/20 transition-all font-bold text-sm"
                                >
                                    Talebi Uygula <ArrowRight className="inline w-4 h-4 ml-1" />
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

                            {Number(ipo.totalOfferedLots || 0) > 0 && (
                                <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/20">
                                    <button 
                                        onClick={() => setShowScenario(!showScenario)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Hizli Dagitim Kestirimi</div>
                                            <span className="text-[10px] text-zinc-600">(Bilgi)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Toplam Lot: {Number(ipo.totalOfferedLots || 0).toLocaleString('tr-TR')}</div>
                                            <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${showScenario ? 'rotate-90' : ''}`} />
                                        </div>
                                    </button>
                                    
                                    {showScenario && (
                                        <div className="px-3 pb-3 overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800">
                                                        <th className="py-2 pr-2">Basvuru</th>
                                                        <th className="py-2 px-2">Hesap Basi Lot</th>
                                                        <th className="py-2 pl-2 text-right">Kisayol</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {scenarioRows.map((r) => (
                                                        <tr key={r.applicants} className="border-b border-zinc-900/70">
                                                            <td className="py-2 pr-2 text-xs font-bold text-zinc-300">{r.applicants.toLocaleString('tr-TR')}</td>
                                                            <td className="py-2 px-2 text-xs font-black text-emerald-400">{r.perAccount.toLocaleString('tr-TR')} Lot</td>
                                                            <td className="py-2 pl-2 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setBatchLot(r.perAccount)}
                                                                    className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
                                                                >
                                                                    Lotu Yaz
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest font-black whitespace-nowrap">Kişi Başı Max Lot:</span>
                                <input
                                    type="number"
                                    placeholder="Örn: 150"
                                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm w-32 focus:border-blue-500 transition-all outline-none font-bold text-blue-400"
                                    value={maxAllottedLot}
                                    onChange={(e) => setMaxAllottedLot(Number(e.target.value))}
                                />
                                <button
                                    onClick={applyMaxDistribution}
                                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-all font-bold text-sm shadow-lg shadow-blue-500/20"
                                >
                                    Otomatik Dağıt <Calculator className="inline w-4 h-4 ml-1" />
                                </button>
                            </div>
                            <div className="text-xs text-zinc-400 border-l border-zinc-800 pl-4">
                                * Seçili hesapların talep miktarına bakar,<br />max lotu geçmeyenlere tamamını verir.
                            </div>
                        </>
                    )}

                    <div className="flex-1" />

                    <button
                        onClick={async () => {
                            // Automatically select all accounts that have lots entered if none are selected
                            let toSave = accountData.filter(a => selectedAccounts.includes(a.id));
                            if (toSave.length === 0) {
                                toSave = accountData.filter(a => (a.requestedLots || 0) > 0 || (a.allottedLots || 0) > 0);
                            }

                            if (toSave.length === 0) {
                                alert("En az bir hesap seçmeli veya lot girişi yapmalısınız!");
                                return;
                            }

                            // Basic validation
                            if (toSave.some(a => (mode === 'talep' && (a.requestedLots || 0) < 0) || (mode === 'dagitim' && (a.allottedLots || 0) < 0))) {
                                alert("Lütfen geçerli bir lot miktarı giriniz!");
                                return;
                            }

                            if (toSave.some(a => a.purchaseType !== 'ipo' && a.purchaseType !== 'portfolio')) {
                                alert("Lutfen alim turunu secin (H/P)!");
                                return;
                            }

                            setIsSaving(true);
                            try {
                                await onSave(toSave, mode);

                                // Mark saved locally so row moves/turns green without requiring a refetch.
                                setAccountData(prev => prev.map(acc => {
                                    const saved = toSave.find(s => s.id === acc.id);
                                    if (!saved) return acc;
                                    return {
                                        ...acc,
                                        requestedLots: saved.requestedLots,
                                        allottedLots: saved.allottedLots,
                                        status: saved.status,
                                        purchaseType: saved.purchaseType,
                                        notes: saved.notes,
                                        originalRequestedLots: saved.requestedLots,
                                        originalAllottedLots: saved.allottedLots,
                                    };
                                }));
                            } catch (e) {
                                console.error(e);
                                alert("Kaydetme sırasında bir hata oluştu!");
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving}
                        className={`px-6 py-2 text-white text-sm font-black rounded-xl transition-all shadow-lg flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''} ${mode === 'talep' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950'}`}
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isSaving ? "Kaydediliyor..." : `Kaydet (${selectedAccounts.length === 0 ? accountData.filter(a => (a.requestedLots || 0) > 0 || (a.allottedLots || 0) > 0).length : selectedAccounts.length} Hesap)`}
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto bg-zinc-950">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur border-b border-zinc-900 z-10">
                            <tr className="text-zinc-500 text-xs uppercase tracking-widest font-black">
                                <th className="p-4 w-12">
                                    <input type="checkbox" checked={selectedAccounts.length === safeAccounts.length && safeAccounts.length > 0} onChange={toggleAll} className={`w-4 h-4 rounded-md focus:ring-0 cursor-pointer ${mode === 'talep' ? 'accent-emerald-500' : 'accent-blue-500'}`} />
                                </th>
                                <th className="p-4">Hesap Sahibİ</th>
                                <th className="p-4 text-xs font-black">HESAP NO</th>
                                 <th className="p-4 text-xs font-black">PAROLA</th>
                                 <th className="p-4">TÜR</th>
                                 <th className="p-4 text-right border-l border-zinc-900/50">TALEP (Lot)</th>
                                 {mode === 'dagitim' && (
                                     <th className="p-4 text-right bg-blue-500/5 text-blue-400">GELEN (Lot)</th>
                                 )}
                                 <th className="p-4 text-right border-l border-zinc-900/50">Maliyet / İade Tutarı</th>
                                 <th className="p-4">Durum</th>
                                 <th className="p-4 text-right">Mevcut Nakİt</th>
                             </tr>
                         </thead>
                        <tbody className="divide-y divide-zinc-900">
                            {sortedAccountData.map((acc) => {
                                const isSelected = selectedAccounts.includes(acc.id);
                                const requestedCost = (acc.requestedLots || 0) * ipo.price;
                                const allottedCost = (acc.allottedLots || 0) * ipo.price;
                                const refundAmmount = requestedCost - allottedCost;

                                const isProblem = acc.status === 'Giriş Yapılamıyor' || acc.status === 'Ulaşılamıyor';
                                const isSaved = mode === 'talep'
                                    ? (Number(acc.originalRequestedLots || 0) > 0)
                                    : (Number(acc.originalAllottedLots || 0) > 0);

                                return (
                                    <tr
                                        key={acc.id}
                                        className={`group border-l-2 transition-all ${isSelected ? (mode === 'talep' ? 'bg-emerald-500/5' : 'bg-blue-500/5') : 'hover:bg-zinc-900/30'
                                            } ${isProblem ? 'bg-amber-500/10 border-amber-500/50' :
                                                isSaved ? 'bg-emerald-500/10 border-emerald-500/50' :
                                                    'border-transparent'
                                            }`}
                                    >
                                        <td className="p-4">
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleAccount(acc.id)} className={`w-4 h-4 rounded-md cursor-pointer ${mode === 'talep' ? 'accent-emerald-500' : 'accent-blue-500'}`} />
                                        </td>
                                        <td className="p-4 font-bold text-zinc-100 whitespace-nowrap">{acc.ownerName || acc.name}</td>

                                        <td className="p-2">
                                            <button
                                                 onClick={() => copyToClipboard(acc.accountNumber)}
                                                className="w-full bg-zinc-900/50 hover:bg-emerald-500/10 border border-zinc-800 hover:border-emerald-500/50 rounded px-2 py-1 text-xs font-mono text-zinc-400 hover:text-emerald-400 transition-all text-center truncate max-w-[150px]"
                                                title="Kopyalamak için tıkla"
                                            >
                                                {acc.accountNumber || '-'}
                                            </button>
                                        </td>

                                        {/* Parola */}
                                        <td className="p-2">
                                            <button
                                                 onClick={() => togglePasswordVisibility(acc.id, acc.password)}
                                                className={`w-full bg-zinc-900/50 hover:bg-emerald-500/10 border rounded px-2 py-1 text-xs font-mono transition-all text-center flex items-center justify-center gap-2 ${visiblePasswords.has(acc.id) ? 'border-emerald-500/50 text-emerald-400' : 'border-zinc-800 text-zinc-400'}`}
                                                title={visiblePasswords.has(acc.id) ? "Gizlemek için tıkla" : "Görmek ve kopyalamak için tıkla"}
                                            >
                                                <span className={visiblePasswords.has(acc.id) ? "" : "tracking-tighter"}>
                                                    {visiblePasswords.has(acc.id) ? (acc.password || '-') : '••••••'}
                                                </span>
                                                <Copy className="w-3 h-3 opacity-50" />
                                            </button>
                                         </td>

                                        {/* Tür Seçimi */}
                                        <td className="p-4">
                                            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 w-fit">
                                                <button onClick={() => setAccountData(prev => prev.map(a => a.id === acc.id ? { ...a, purchaseType: 'ipo' } : a))} className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${acc.purchaseType === 'ipo' ? 'bg-amber-500 text-black' : 'text-zinc-600'}`}>H</button>
                                                <button onClick={() => setAccountData(prev => prev.map(a => a.id === acc.id ? { ...a, purchaseType: 'portfolio' } : a))} className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${acc.purchaseType === 'portfolio' ? 'bg-blue-500 text-white' : 'text-zinc-600'}`}>P</button>
                                            </div>
                                        </td>

                                        {/* Talep Sütunu */}
                                        <td className="p-4 text-right border-l border-zinc-900/50">
                                            <input
                                                type="number"
                                                value={acc.requestedLots}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setAccountData(prev => prev.map(a => a.id === acc.id ? { ...a, requestedLots: val } : a));
                                                }}
                                                disabled={mode === 'dagitim'}
                                                className={`bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1.5 text-right w-24 outline-none transition-all ${mode === 'talep' ? 'focus:border-emerald-500 text-emerald-100' : 'opacity-50 text-zinc-500 bg-transparent border-transparent'}`}
                                            />
                                        </td>

                                        {/* Gelen (Dağıtım) Sütunu */}
                                        {mode === 'dagitim' && (
                                            <td className="p-4 text-right bg-blue-500/5">
                                                <input
                                                    type="number"
                                                    value={acc.allottedLots}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setAccountData(prev => prev.map(a => a.id === acc.id ? { ...a, allottedLots: val } : a));
                                                    }}
                                                    className="bg-zinc-900/50 border border-blue-900/50 text-blue-400 font-bold rounded-lg px-2 py-1.5 text-right w-24 outline-none focus:border-blue-500 transition-all focus:bg-zinc-900"
                                                />
                                            </td>
                                        )}

                                        {/* Olası Maliyetler ve İadeler */}
                                        <td className="p-4 text-right font-mono text-sm border-l border-zinc-900/50">
                                            {mode === 'talep' ? (
                                                <div className="text-amber-400">-{requestedCost.toLocaleString('tr-TR')} ₺</div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-rose-400">Maliyet: -{allottedCost.toLocaleString('tr-TR')} ₺</span>
                                                    {refundAmmount > 0 && <span className="text-emerald-400 text-xs font-bold">+ {refundAmmount.toLocaleString('tr-TR')} ₺ İade</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <select
                                                value={acc.status}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAccountData(prev => prev.map(a => a.id === acc.id ? { ...a, status: val } : a));
                                                }}
                                                className={`bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none focus:border-emerald-500 transition-all font-bold ${isProblem ? 'text-amber-400' : isSaved ? 'text-emerald-400' : 'text-zinc-400'
                                                    }`}
                                            >
                                                <option>Bekliyor</option>
                                                <option>Talepte</option>
                                                <option>Giriş Yapılamıyor</option>
                                                <option>Ulaşılamıyor</option>
                                                <option>Dağıtıldı</option>
                                                <option>İptal</option>
                                                <option>Satıldı</option>
                                            </select>
                                        </td>
                                        <td className={`p-4 text-right font-mono text-sm ${(acc.cashBalance || acc.cash || 0) < 0 ? 'text-rose-400/80 font-bold' : 'text-zinc-500'}`}>
                                            {(acc.cashBalance || acc.cash || 0).toLocaleString('tr-TR')} ₺
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
