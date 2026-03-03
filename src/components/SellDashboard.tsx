"use client";

import React, { useState } from "react";
import {
    X,
    TrendingDown,
    DollarSign,
    Percent
} from "lucide-react";
import { motion } from "framer-motion";
import { sellParticipations } from "@/lib/data-service";
import { auth } from "@/lib/firebase";

interface SellProps {
    participationId: string;
    ticker: string;
    accounts: any[];
    participations: any[]; // { accountId, allottedLots, requestedLots, status, pricing? }
    onClose: () => void;
    onSave: () => void;
}

export default function SellDashboard({ participationId, ticker, accounts, participations, onClose, onSave }: SellProps) {
    const [sellPrice, setSellPrice] = useState<number>(0);
    const [batchMode, setBatchMode] = useState(true);
    const [sellData, setSellData] = useState<any[]>(
        participations.filter(p => p.allottedLots > 0).map(p => {
            const acc = accounts.find(a => a.id === p.accountId) || {};
            return {
                ...acc,
                allottedLots: p.allottedLots,
                sellLots: p.allottedLots,
                sellPrice: 0,
                costPrice: p.lotPrice || p.price || 0
            };
        })
    );

    const handleSell = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        if (sellData.length === 0) {
            alert("Bu hissede satilacak lot bulunamadi!");
            return;
        }

        if (batchMode && (!sellPrice || sellPrice <= 0)) {
            alert("Lutfen gecerli bir toplu satis fiyati girin!");
            return;
        }

        if (!batchMode && sellData.some(s => !s.sellPrice || s.sellPrice <= 0)) {
            alert("Lutfen her hesap icin gecerli bir satis fiyati girin!");
            return;
        }

        if (sellData.some(s => (s.sellLots || 0) < 0 || (s.sellLots || 0) > (s.allottedLots || 0))) {
            alert("Satilacak lot miktari mevcut lotu asamaz!");
            return;
        }

        const dataToSave = sellData.map(s => ({
            accountId: s.id,
            sellLots: s.sellLots,
            sellPrice: batchMode ? sellPrice : s.sellPrice,
            currentLots: s.allottedLots
        }));

        try {
            await sellParticipations(userId, participationId, dataToSave);
            alert("Satış İşlemi Başarılı!");
            onSave();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Hata Oluştu!");
        }
    };

    const totalProfit = sellData.reduce((sum, s) => {
        const sprice = batchMode ? sellPrice : s.sellPrice;
        return sum + (s.sellLots * (sprice - s.costPrice));
    }, 0);

    const totalProceeds = sellData.reduce((sum, s) => {
        const sprice = batchMode ? sellPrice : s.sellPrice;
        return sum + (s.sellLots * sprice);
    }, 0);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-12 overflow-hidden bg-black/60 backdrop-blur-sm"
        >
            <div className="bg-zinc-950 border border-zinc-900 w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col h-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20">
                            <TrendingDown className="w-6 h-6 text-rose-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">{ticker} - Toplu Satış Ekranı</h2>
                            <p className="text-zinc-500 text-sm font-medium">Tüm hesaplardaki lotları hızlıca satın.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-auto p-8 space-y-8">
                    {/* Bulk Settings */}
                    <div className="p-6 bg-zinc-900/30 border border-zinc-900 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2">SATIS MODU</label>
                            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
                                <button
                                    onClick={() => setBatchMode(true)}
                                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${batchMode ? 'bg-rose-500 text-white' : 'text-zinc-500 hover:text-white'}`}
                                >
                                    Toplu Fiyat
                                </button>
                                <button
                                    onClick={() => setBatchMode(false)}
                                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!batchMode ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                                >
                                    Tek Tek
                                </button>
                            </div>

                            {batchMode && (
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="number"
                                    value={sellPrice || ""}
                                    onChange={(e) => setSellPrice(Number(e.target.value))}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-rose-500 transition-all font-bold"
                                    placeholder="Fiyat Girin..."
                                />
                            </div>
                            )}
                        </div>
                        <div className="flex flex-col justify-end">
                            <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-amber-500">
                                <Percent className="w-5 h-5" />
                                <div>
                                    <p className="text-[10px] uppercase font-black opacity-60">Tahmini Kâr/Zarar</p>
                                    <p className="text-xl font-black">{totalProfit.toLocaleString('tr-TR')} TL</p>
                                </div>
                            </div>
                            <div className="mt-3 text-xs text-zinc-500 font-bold">
                                Toplam Satis: {totalProceeds.toLocaleString('tr-TR')} TL
                            </div>
                        </div>
                        <div className="flex items-end justify-end">
                            <button
                                onClick={handleSell}
                                className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black transition-all shadow-lg hover:shadow-rose-500/20 flex items-center gap-2"
                            >
                                <TrendingDown className="w-5 h-5" /> SATIŞI ONAYLA
                            </button>
                        </div>
                    </div>

                    {/* Accounts Table */}
                    <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-zinc-900/50">
                                <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-900">
                                    <th className="p-4">Hesap Sahibi</th>
                                    <th className="p-4">Lot Sayısı</th>
                                    <th className="p-4">Satılacak Lot</th>
                                    <th className="p-4">Maliyet</th>
                                    <th className="p-4">Satis Fiyati</th>
                                    <th className="p-4">Kar/Zarar</th>
                                    <th className="p-4 text-right">Durum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900">
                                {sellData.map((acc) => (
                                    <tr key={acc.id} className="hover:bg-zinc-900/30 transition-all">
                                        <td className="p-4 text-sm font-bold text-white">{acc.ownerName}</td>
                                        <td className="p-4 text-sm text-zinc-400 font-bold">{acc.allottedLots} Lot</td>
                                        <td className="p-4">
                                            <input
                                                type="number"
                                                value={acc.sellLots}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setSellData(prev => prev.map(a => a.id === acc.id ? { ...a, sellLots: val } : a));
                                                }}
                                                className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-sm text-white"
                                            />
                                        </td>
                                        <td className="p-4 text-xs text-zinc-500">{acc.costPrice || '?'} TL</td>
                                        <td className="p-4">
                                            {batchMode ? (
                                                <span className="text-xs text-zinc-400 font-bold">{sellPrice ? `${sellPrice} TL` : '-'}</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={acc.sellPrice || ""}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setSellData(prev => prev.map(a => a.id === acc.id ? { ...a, sellPrice: val } : a));
                                                    }}
                                                    className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-sm text-white"
                                                    placeholder="Fiyat"
                                                />
                                            )}
                                        </td>
                                        <td className={`p-4 text-xs font-black ${(acc.sellLots * ((batchMode ? sellPrice : acc.sellPrice) - acc.costPrice)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {(acc.sellLots * ((batchMode ? sellPrice : acc.sellPrice) - acc.costPrice)).toLocaleString('tr-TR')} TL
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Hissede</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
