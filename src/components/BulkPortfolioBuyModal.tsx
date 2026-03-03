"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Check, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { addHoldingToAccount, saveIPO } from "@/lib/data-service";
import { fetchLatestPriceTwelve } from "@/lib/price-service";

interface BulkPortfolioBuyModalProps {
  userId: string;
  accounts: any[];
  ipos: any[];
  onClose: () => void;
  onSaved: () => void;
}

export default function BulkPortfolioBuyModal({ userId, accounts, ipos, onClose, onSaved }: BulkPortfolioBuyModalProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [lots, setLots] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoPricing, setIsAutoPricing] = useState(false);

  // Get unique tickers from portfolio items + IPOs
  const availableTickers = Array.from(new Set([
    ...(ipos || []).map((i: any) => i.ticker?.toUpperCase()).filter(Boolean)
  ])).sort();

  const toggleAccount = (accId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    );
  };

  const toggleAll = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map((a: any) => a.id));
    }
  };

  const fetchPrice = async () => {
    if (!selectedTicker) return;
    setIsAutoPricing(true);
    try {
      const p = await fetchLatestPriceTwelve(selectedTicker);
      if (p) setPrice(p);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAutoPricing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTicker || lots <= 0 || selectedAccounts.length === 0) {
      alert("Lütfen hisse, lot ve en az bir hesap seçin!");
      return;
    }

    setIsSaving(true);
    try {
      for (const accId of selectedAccounts) {
        const account = accounts.find((a: any) => a.id === accId);
        if (!account) continue;

        await addHoldingToAccount(
          userId,
          accId,
          selectedTicker,
          lots,
          'portfolio',
          price,
          true
        );
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Kaydetme sırasında hata oluştu!");
    } finally {
      setIsSaving(false);
    }
  };

  const totalCost = lots * price;

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
        className="relative bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Toplu Hisse Al</h2>
            <p className="text-sm text-zinc-500">Bir hisseyi birden fazla hesaba ekle</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Hisse Secimi */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Hisse (Ticker)</label>
            <div className="flex gap-2">
              <select
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none"
              >
                <option value="">Seçiniz...</option>
                {availableTickers.map((t: any) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={fetchPrice}
                disabled={!selectedTicker || isAutoPricing}
                className="px-4 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 font-bold text-sm hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isAutoPricing ? "..." : "Fiyat"}
              </button>
            </div>
          </div>

          {/* Lot ve Fiyat */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Lot</label>
              <input
                type="number"
                value={lots || ""}
                onChange={(e) => setLots(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Fiyat (TL)</label>
              <input
                type="number"
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none font-bold"
                placeholder="0"
              />
            </div>
          </div>

          {/* Toplam */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-bold text-sm">Toplam Maliyet</span>
              <span className="text-emerald-400 font-black text-xl">{totalCost.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
            </div>
          </div>

          {/* Hesap Secimi */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Hesaplar</label>
              <button onClick={toggleAll} className="text-xs text-emerald-400 font-bold">
                {selectedAccounts.length === accounts.length ? "Tümünü Kaldır" : "Tümünü Seç"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {accounts.map((account: any) => (
                <div
                  key={account.id}
                  onClick={() => toggleAccount(account.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedAccounts.includes(account.id)
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedAccounts.includes(account.id) ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                    }`}>
                      {selectedAccounts.includes(account.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{account.ownerName || account.name}</p>
                      <p className="text-xs text-zinc-500">{account.bankName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Bakiye</p>
                    <p className="font-bold text-emerald-400">{(account.cashBalance || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 text-right">{selectedAccounts.length} / {accounts.length} hesap seçildi</p>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-900 flex justify-between items-center bg-zinc-900/30">
          <button
            onClick={onClose}
            className="px-6 py-3 text-zinc-500 hover:text-white font-bold transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedTicker || lots <= 0 || selectedAccounts.length === 0}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Kaydediliyor..." : "Tümüne Uygula"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
