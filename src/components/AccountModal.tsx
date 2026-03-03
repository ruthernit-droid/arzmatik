"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { BANKS, getBankLoginUrl, Bank } from "@/constants/banks";

interface AccountModalProps {
    account?: any;
    onClose: () => void;
    onSave: (account: any) => void;
    onDelete?: (id: string) => void;
}

export default function AccountModal({ account, onClose, onSave, onDelete }: AccountModalProps) {
    const [formData, setFormData] = useState({
        ownerName: "",
        bankName: "",
        bankId: "",
        cashBalance: 0,
        accountNumber: "",
        idNo: "",
        password: "",
        notes: "",
        isActive: true
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [customBanks, setCustomBanks] = useState<Bank[]>([]);

    const allBanks = useMemo(() => [...BANKS, ...customBanks], [customBanks]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem("customBanks");
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const normalized = parsed
                    .filter((b: any) => b && typeof b.id === "string" && typeof b.name === "string")
                    .map((b: any) => ({
                        id: String(b.id),
                        name: String(b.name),
                        shortName: String(b.shortName || b.name),
                        loginUrl: String(b.loginUrl || ""),
                        isCustom: true,
                    }));
                setCustomBanks(normalized);
            }
        } catch {
            setCustomBanks([]);
        }
    }, []);

    useEffect(() => {
        if (account) {
            // Find bank by name match
            const matchedBank = allBanks.find(b => 
                account.bankName?.toLowerCase().includes(b.name.toLowerCase()) ||
                b.name.toLowerCase().includes(account.bankName?.toLowerCase())
            );
            
            setFormData({
                ownerName: account.ownerName || account.name || "",
                bankName: account.bankName || account.bank || "",
                bankId: account.bankId || matchedBank?.id || "",
                cashBalance: account.cashBalance || account.cash || 0,
                accountNumber: account.accountNumber || account.customerNo || "",
                idNo: account.idNo || "",
                password: account.password || "",
                notes: account.notes || "",
                isActive: account.isActive !== undefined ? account.isActive : true
            });
        }
    }, [account, allBanks]);

    const handleBankChange = (bankId: string) => {
        const bank = allBanks.find(b => b.id === bankId);
        setFormData({
            ...formData,
            bankId,
            bankName: bank?.name || formData.bankName
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, id: account?.id });
    };

    const selectedBankUrl = formData.bankId ? getBankLoginUrl(formData.bankId) : "";

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
                className="relative bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
                <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">{account ? "Hesabı Düzenle" : "Yeni Hesap Ekle"}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
                    <div className="p-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Hesap Sahibi</label>
                            <input
                                required
                                value={formData.ownerName}
                                onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-emerald-500 outline-none transition-all text-lg"
                                placeholder="Ad Soyad"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Banka / Aracı Kurum</label>
                            <select
                                value={formData.bankId}
                                onChange={e => handleBankChange(e.target.value)}
                                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-emerald-500 outline-none transition-all text-lg"
                            >
                                <option value="">Banka seçin...</option>
                                {allBanks.map(bank => (
                                    <option key={bank.id} value={bank.id}>{bank.name}</option>
                                ))}
                            </select>
                            {selectedBankUrl && (
                                <a 
                                    href={selectedBankUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                    ↗ {selectedBankUrl}
                                </a>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Bakiye (TRY)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={formData.cashBalance || 0}
                                onChange={e => {
                                    const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                    setFormData({ ...formData, cashBalance: isNaN(val) ? 0 : val });
                                }}
                                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-emerald-500 outline-none transition-all text-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Hesap No</label>
                            <div className="relative group">
                                <input
                                    value={formData.accountNumber}
                                    onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                                    className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-emerald-500 outline-none transition-all text-lg font-mono"
                                    placeholder="1234567"
                                />
                                <button type="button" onClick={() => navigator.clipboard.writeText(formData.accountNumber)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 italic text-[10px]">KOPYALA</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500">TC Kimlik No</label>
                            <div className="relative group">
                                <input
                                    value={formData.idNo}
                                    onChange={e => setFormData({ ...formData, idNo: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono"
                                    placeholder="00000000010"
                                />
                                <button type="button" onClick={() => navigator.clipboard.writeText(formData.idNo)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 italic text-[10px]">KOPYALA</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Şifre / Pin</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                                    placeholder="****"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-white transition-all">{showPassword ? <X className="w-3 h-3" /> : <Save className="w-3 h-3" />}</button>
                                    <button type="button" onClick={() => navigator.clipboard.writeText(formData.password)} className="p-1 px-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-white transition-all text-[8px] font-black uppercase">Kopyala</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Özel Notlar</label>
                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all resize-none"
                            placeholder="Hesap hakkında notlar..."
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-4 h-4 rounded accent-emerald-500"
                            id="isActive"
                        />
                        <label htmlFor="isActive" className="text-sm text-zinc-400 cursor-pointer">Bu hesap aktif olarak halka arzlara katılsın mı?</label>
                    </div>

                    <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur-sm p-4 border-t border-zinc-900 mt-auto flex justify-between items-center">
                        {account?.id && onDelete && (
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={async () => {
                                    console.log("Delete attempt for:", account.id);
                                    if (confirm("Bu hesabı silmek istediğinize emin misiniz?")) {
                                        setIsDeleting(true);
                                        try {
                                            await onDelete(account.id);
                                        } finally {
                                            setIsDeleting(false);
                                        }
                                    }
                                }}
                                className={`flex items-center gap-2 px-6 py-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-all ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Trash2 className="w-4 h-4" /> {isDeleting ? "Siliniyor..." : "Hesabı Sil"}
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
