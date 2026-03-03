"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getParticipationsForIPO, processBatchOperation, sellParticipations } from "@/lib/data-service";

interface BackfillWizardModalProps {
  ipo: { id: string; ticker: string; companyName: string; price: number };
  accounts: any[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

type Step = 1 | 2 | 3;

export default function BackfillWizardModal({ ipo, accounts, onClose, onSaved }: BackfillWizardModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saleDate, setSaleDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      setLoading(true);
      try {
        const parts = await getParticipationsForIPO(userId, accounts.map((a: any) => a.id), ipo.id, ipo.ticker);
        const nextRows = accounts.map((acc: any) => {
          const p = parts.find((x: any) => x.accountId === acc.id) || {};
          return {
            ...acc,
            requestedLots: Number(p.requestedLots || 0),
            allottedLots: Number(p.allottedLots || 0),
            sellLots: Number(p.allottedLots || 0),
            sellPrice: 0,
            lotPrice: Number(p.lotPrice || ipo.price || 0),
            status: p.status || "Talepte",
            purchaseType: p.purchaseType || "ipo",
            originalRequestedLots: Number(p.requestedLots || 0),
            originalAllottedLots: Number(p.allottedLots || 0),
          };
        });
        setRows(nextRows);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [ipo.id, ipo.ticker, ipo.price, accounts]);

  const totalRequested = useMemo(() => rows.reduce((s, r) => s + Number(r.requestedLots || 0), 0), [rows]);
  const totalAllotted = useMemo(() => rows.reduce((s, r) => s + Number(r.allottedLots || 0), 0), [rows]);
  const totalSellLots = useMemo(() => rows.reduce((s, r) => s + Number(r.sellLots || 0), 0), [rows]);

  const saveCurrentStep = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    setSaving(true);
    try {
      if (step === 1) {
        await processBatchOperation(userId, ipo.id, Number(ipo.price || 0), rows.map((r: any) => ({
          ...r,
          status: Number(r.requestedLots || 0) > 0 ? "Talepte" : (r.status || "Bekliyor"),
        })), "talep");
        setRows((prev) => prev.map((r: any) => ({ ...r, originalRequestedLots: Number(r.requestedLots || 0) })));
      }

      if (step === 2) {
        await processBatchOperation(userId, ipo.id, Number(ipo.price || 0), rows.map((r: any) => ({
          ...r,
          status: Number(r.allottedLots || 0) > 0 ? "Dağıtıldı" : (r.status || "Talepte"),
          requestedLots: Math.max(Number(r.requestedLots || 0), Number(r.allottedLots || 0)),
        })), "dagitim");
        setRows((prev) => prev.map((r: any) => ({
          ...r,
          originalRequestedLots: Math.max(Number(r.requestedLots || 0), Number(r.allottedLots || 0)),
          requestedLots: Math.max(Number(r.requestedLots || 0), Number(r.allottedLots || 0)),
          originalAllottedLots: Number(r.allottedLots || 0),
          sellLots: Number(r.sellLots || r.allottedLots || 0),
        })));
      }

      if (step === 3) {
        const sellRows = rows
          .filter((r: any) => Number(r.sellLots || 0) > 0)
          .map((r: any) => ({
            accountId: r.id,
            sellLots: Number(r.sellLots || 0),
            sellPrice: Number(r.sellPrice || 0),
            currentLots: Number(r.allottedLots || 0),
            lotPrice: Number(r.lotPrice || ipo.price || 0),
            saleDate,
          }))
          .filter((r: any) => r.sellPrice > 0);

        if (sellRows.length > 0) {
          await sellParticipations(userId, ipo.id, sellRows);
        }
      }

      await onSaved();

      if (step < 3) setStep((s) => (s + 1) as Step);
      else onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black">Gecmise Donuk Duzeltme Sihirbazi - {ipo.ticker}</h3>
            <p className="text-xs text-zinc-500">Adim {step}/3: Talep → Dagitim → Satis</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-auto max-h-[70vh] space-y-4">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className={`p-2 rounded-lg border ${step === 1 ? "border-emerald-500/40 bg-emerald-500/10" : "border-zinc-800"}`}>1. Talep ({totalRequested})</div>
            <div className={`p-2 rounded-lg border ${step === 2 ? "border-blue-500/40 bg-blue-500/10" : "border-zinc-800"}`}>2. Dagitim ({totalAllotted})</div>
            <div className={`p-2 rounded-lg border ${step === 3 ? "border-rose-500/40 bg-rose-500/10" : "border-zinc-800"}`}>3. Satis ({totalSellLots})</div>
          </div>

          {step === 3 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-400">Satis Tarihi</label>
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm" />
            </div>
          )}

          {loading ? (
            <p className="text-sm text-zinc-500">Yukleniyor...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                    <th className="p-2">Hesap</th>
                    <th className="p-2 text-right">Talep</th>
                    <th className="p-2 text-right">Dagitim</th>
                    <th className="p-2 text-right">Satis Lot</th>
                    <th className="p-2 text-right">Satis Fiyat</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-zinc-900">
                      <td className="p-2 text-xs font-bold">{r.ownerName || r.name}</td>
                      <td className="p-2 text-right">
                        <input type="number" value={r.requestedLots} onChange={(e) => setRows((prev) => prev.map((x: any) => x.id === r.id ? { ...x, requestedLots: Number(e.target.value || 0) } : x))} className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs" disabled={step !== 1} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" value={r.allottedLots} onChange={(e) => setRows((prev) => prev.map((x: any) => x.id === r.id ? { ...x, allottedLots: Number(e.target.value || 0) } : x))} className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs" disabled={step !== 2} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" value={r.sellLots} onChange={(e) => setRows((prev) => prev.map((x: any) => x.id === r.id ? { ...x, sellLots: Number(e.target.value || 0) } : x))} className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs" disabled={step !== 3} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" value={r.sellPrice || ""} onChange={(e) => setRows((prev) => prev.map((x: any) => x.id === r.id ? { ...x, sellPrice: Number(e.target.value || 0) } : x))} className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs" disabled={step !== 3} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-900 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => (Math.max(1, s - 1) as Step))}
            disabled={step === 1}
            className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold disabled:opacity-40"
          >
            Geri
          </button>
          <button onClick={saveCurrentStep} disabled={saving || loading} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            {saving ? "Kaydediliyor..." : (step === 3 ? "Bitir ve Kaydet" : "Kaydet ve Sonraki")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
