"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { saveIPO } from "@/lib/data-service";

interface CapitalIncrease {
    date: string;
    ratio: number; // percentage like 100 for 100%
    isPaid: boolean; // true = bedelli, false = bedelsiz
}

interface StockModalProps {
    stock: any;
    onClose: () => void;
    onSave: () => void;
}

export default function StockModal({ stock, onClose, onSave }: StockModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        ipoPrice: stock?.ipoPrice || stock?.price || 0,
        capitalIncreases: [] as CapitalIncrease[],
    });

    const addCapitalIncrease = () => {
        setFormData(prev => ({
            ...prev,
            capitalIncreases: [...prev.capitalIncreases, { date: new Date().toISOString().split('T')[0], ratio: 100, isPaid: false }]
        }));
    };

    const updateCapitalIncrease = (index: number, field: keyof CapitalIncrease, value: any) => {
        setFormData(prev => ({
            ...prev,
            capitalIncreases: prev.capitalIncreases.map((ci, i) => 
                i === index ? { ...ci, [field]: value } : ci
            )
        }));
    };

    const removeCapitalIncrease = (index: number) => {
        setFormData(prev => ({
            ...prev,
            capitalIncreases: prev.capitalIncreases.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveIPO({
                id: stock.id,
                ticker: stock.ticker,
                companyName: stock.companyName,
                ipoPrice: Number(formData.ipoPrice),
                capitalIncreases: formData.capitalIncreases,
                price: stock.price, // Keep current price
                status: stock.status,
            });
            onSave();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Kaydetme hatasi!");
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate current effective lots based on capital increases
    const calculateEffectiveLots = (originalLots: number) => {
        let lots = originalLots;
        formData.capitalIncreases.forEach(ci => {
            if (ci.isPaid) {
                // Bedelli: yeni para ödeyerek artıyor
                // ratio 100 = 1:1 bedelli, yani 100% more
                lots = lots + (lots * ci.ratio / 100);
            } else {
                // Bedelsiz: bedava gelen
                lots = lots + (lots * ci.ratio / 100);
            }
        });
        return lots;
    };

    // Calculate effective price after capital increases
    const calculateEffectivePrice = (originalPrice: number) => {
        let multiplier = 1;
        formData.capitalIncreases.forEach(ci => {
            multiplier = multiplier * (1 + ci.ratio / 100);
        });
        return originalPrice / multiplier;
    };

    const effectiveLots = calculateEffectiveLots(1);
    const effectivePrice = calculateEffectivePrice(Number(formData.ipoPrice));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
            <div className="w-full max-w-2xl glass-card bg-zinc-950 border-emerald-500/20 shadow-2xl overflow-hidden !p-0">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/10">
                    <div>
                        <h2 className="text-xl font-black text-white">Hisse Duzenle</h2>
                        <p className="text-zinc-500 text-sm font-bold">{stock.ticker} - {stock.companyName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Halka Arz Fiyatı */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">
                            Halka Arz Fiyatı (TL)
                        </label>
                        <input
                            type="number"
                            value={formData.ipoPrice}
                            onChange={(e) => setFormData(prev => ({ ...prev, ipoPrice: Number(e.target.value) }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all font-bold"
                            placeholder="0.00"
                        />
                    </div>

                    {/* Sermaye Artırımları */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                                Sermaye Artırımları
                            </label>
                            <button
                                onClick={addCapitalIncrease}
                                className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all"
                            >
                                <Plus className="w-3 h-3" /> Ekle
                            </button>
                        </div>

                        <div className="space-y-2">
                            {formData.capitalIncreases.map((ci, index) => (
                                <div key={index} className="flex items-center gap-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                                    <input
                                        type="date"
                                        value={ci.date}
                                        onChange={(e) => updateCapitalIncrease(index, 'date', e.target.value)}
                                        className="bg-transparent border-none text-white text-sm font-bold outline-none"
                                    />
                                    <input
                                        type="number"
                                        value={ci.ratio}
                                        onChange={(e) => updateCapitalIncrease(index, 'ratio', Number(e.target.value))}
                                        className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm font-bold outline-none focus:border-emerald-500"
                                        placeholder="%"
                                    />
                                    <span className="text-xs text-zinc-500 font-bold">%</span>
                                    
                                    <select
                                        value={ci.isPaid ? "bedelli" : "bedelsiz"}
                                        onChange={(e) => updateCapitalIncrease(index, 'isPaid', e.target.value === "bedelli")}
                                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:border-emerald-500"
                                    >
                                        <option value="bedelsiz">Bedelsiz</option>
                                        <option value="bedelli">Bedelli</option>
                                    </select>

                                    <button
                                        onClick={() => removeCapitalIncrease(index)}
                                        className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            {formData.capitalIncreases.length === 0 && (
                                <p className="text-zinc-500 text-sm font-bold text-center py-4">
                                    Sermaye artırımı eklenmedi.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Hesaplama Önizlemesi */}
                    {Number(formData.ipoPrice) > 0 && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3">Onizleme (1 Lot Bazında)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Arz Fiyatı</p>
                                    <p className="text-lg font-black text-white">{Number(formData.ipoPrice).toLocaleString('tr-TR')} TL</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Sermaye Artış Sonrası Fiyat</p>
                                    <p className="text-lg font-black text-amber-400">{effectivePrice.toFixed(2)} TL</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Lot Carpanı</p>
                                    <p className="text-lg font-black text-white">{effectiveLots.toFixed(2)}x</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Toplam Artış</p>
                                    <p className="text-lg font-black text-emerald-400">+{((effectiveLots - 1) * 100).toFixed(0)}%</p>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-3">
                                * Bu hesaplama bilgi amaçlıdır. Sermaye artırımı oranları toplam lot sayısını ve hisse fiyatını etkiler.
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-zinc-700 text-zinc-400 hover:text-white rounded-xl font-bold transition-all"
                    >
                        Iptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
