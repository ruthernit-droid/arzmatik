"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

interface IpoModalProps {
    ipo?: any;
    onClose: () => void;
    onSave: (ipo: any) => void;
    onDelete?: (id: string) => void;
}

export default function IpoModal({ ipo, onClose, onSave, onDelete }: IpoModalProps) {
    const [formData, setFormData] = useState({
        companyName: "",
        ticker: "",
        price: 0,
        ipoPrice: 0,
        totalOfferedLots: 0,
        status: "Talep Toplanıyor",
        demandEndDate: ""
    });

    useEffect(() => {
        if (ipo) {
            setFormData({
                companyName: ipo.companyName || ipo.name || "",
                ticker: ipo.ticker || "",
                price: ipo.price || 0,
                ipoPrice: Number(ipo.ipoPrice ?? ipo.price ?? 0),
                totalOfferedLots: Number(ipo.totalOfferedLots || 0),
                status: ipo.status || "Talep Toplanıyor",
                demandEndDate: ipo.demandEndDate || ""
            });
        }
    }, [ipo]);

    const scenarioApplicants = [300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1150000, 1300000];
    const scenarioRows = scenarioApplicants.map((applicants) => {
        const totalLots = Number(formData.totalOfferedLots || 0);
        const perAccount = applicants > 0 ? Math.floor(totalLots / applicants) : 0;
        return { applicants, perAccount };
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, id: ipo?.id });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white">{ipo ? "Halka Arzı Düzenle" : "Yeni Halka Arz Ekle"}</h2>
                        <p className="text-sm text-zinc-500">Şirket bilgilerini ve talep durumunu güncelleyin.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Şirket Ünvanı</label>
                            <input
                                required
                                value={formData.companyName}
                                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                                placeholder="Örn: ABC Teknoloji"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Borsa Kodu (Ticker)</label>
                                <input
                                    required
                                    value={formData.ticker}
                                    onChange={e => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono"
                                    placeholder="EXAMPLE"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Arz Fiyatı (TRY)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.ipoPrice || formData.price}
                                    onChange={e => {
                                        const v = Number(e.target.value || 0);
                                        setFormData({ ...formData, ipoPrice: v, price: v });
                                    }}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Toplam Arz Edilecek Lot (Tahmini)</label>
                            <input
                                type="number"
                                value={formData.totalOfferedLots || ""}
                                onChange={e => setFormData({ ...formData, totalOfferedLots: Number(e.target.value || 0) })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                                placeholder="Orn: 130000000"
                            />
                            <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Talep ekraninda hesap basi olasi dagitim kestirimi icin kullanilir.</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                            <div className="p-3 border-b border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-500">Olasi Dagitim Senaryolari (300 bin - 1.3 milyon basvuru)</div>
                            <div className="max-h-56 overflow-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800">
                                            <th className="p-3">Basvuru Sayisi</th>
                                            <th className="p-3 text-right">Hesap Basi Olasi Lot</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scenarioRows.map((r) => (
                                            <tr key={r.applicants} className="border-b border-zinc-900/70">
                                                <td className="p-3 text-xs font-bold text-zinc-300">{r.applicants.toLocaleString('tr-TR')}</td>
                                                <td className="p-3 text-right text-xs font-black text-emerald-400">{r.perAccount.toLocaleString('tr-TR')} Lot</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Halka Arz Durumu</label>
                            <select
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all appearance-none"
                            >
                                <option value="Yolda">Yolda</option>
                                <option value="Talep Toplanıyor">Talep Toplanıyor</option>
                                <option value="Liderlik">Liderlik</option>
                                <option value="Borsada İşlem Görüyor">Borsada İşlem Görüyor</option>
                                <option value="Tamamlandı">Tamamlandı</option>
                                <option value="Kapandı">Kapandı</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Talep Sonu / Tarih (Opsiyonel)</label>
                            <input
                                type="date"
                                value={formData.demandEndDate}
                                onChange={e => setFormData({ ...formData, demandEndDate: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-zinc-900">
                        {ipo && onDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm("Bu halka arzı silmek istediğinize emin misiniz?")) {
                                        onDelete(ipo.id);
                                    }
                                }}
                                className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-all"
                            >
                                <Trash2 className="w-4 h-4" /> Sil
                            </button>
                        )}
                        <div className="flex gap-4 ml-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 text-zinc-500 hover:text-white font-bold transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all"
                            >
                                <Save className="w-4 h-4" /> Kaydet
                            </button>
                        </div>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
