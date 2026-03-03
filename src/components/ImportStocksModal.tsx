"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, Upload, X } from "lucide-react";
import { fetchLatestPriceTwelve } from "@/lib/price-service";
import { saveIPO } from "@/lib/data-service";

type Row = { ticker: string; name: string };

function parseCsv(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Accept formats:
  // TICKER,NAME
  // TICKER;NAME
  // TICKER<TAB>NAME
  const out: Row[] = [];
  for (const line of lines) {
    const parts = line.includes(";") ? line.split(";") : line.includes("\t") ? line.split("\t") : line.split(",");
    const a = String(parts[0] || "").trim();
    const b = String(parts.slice(1).join(" ") || "").trim();
    const ticker = a.toUpperCase();
    if (!ticker || ticker === "TICKER") continue;
    out.push({ ticker, name: b || ticker });
  }
  return out;
}

export default function ImportStocksModal({
  ipos,
  onClose,
  onDone,
}: {
  ipos: any[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<'twelve' | 'csv'>('twelve');
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [fetchPrices, setFetchPrices] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; ok: number; fail: number } | null>(null);

  const [tdWithPrices, setTdWithPrices] = useState(true);
  const [tdLimit, setTdLimit] = useState<number>(500);
  const [tdOffset, setTdOffset] = useState<number>(0);

  const existingTickers = useMemo(() => new Set((ipos || []).map((i: any) => String(i.ticker || "").toUpperCase())), [ipos]);
  const newRows = useMemo(() => rows.filter(r => !existingTickers.has(r.ticker)), [rows, existingTickers]);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    setRows(parseCsv(text));
  };

  const run = async () => {
    if (tab !== 'csv') return;
    if (newRows.length === 0) {
      alert("Iceri aktarilacak yeni hisse yok.");
      return;
    }
    setIsRunning(true);
    setProgress({ done: 0, total: newRows.length, ok: 0, fail: 0 });
    try {
      let done = 0;
      let ok = 0;
      let fail = 0;
      for (const r of newRows) {
        try {
          let price = 0;
          if (fetchPrices) {
            const p = await fetchLatestPriceTwelve(r.ticker);
            if (p) price = p;
          }
          await saveIPO({
            companyName: r.name,
            ticker: r.ticker,
            price,
            status: "Borsada İşlem Görüyor",
          });
          ok++;
        } catch (e) {
          console.error(e);
          fail++;
        } finally {
          done++;
          setProgress({ done, total: newRows.length, ok, fail });
          await new Promise((res) => setTimeout(res, 250));
        }
      }
      onDone();
      alert(`Import tamamlandi. Basarili: ${ok}, Hatali: ${fail}`);
      onClose();
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  const runTwelve = async () => {
    if (tab !== 'twelve') return;
    setIsRunning(true);
    try {
      const { auth } = await import("@/lib/firebase");
      const token = await auth?.currentUser?.getIdToken?.();
      if (!token) {
        throw new Error("Oturum tokeni alinmadi. Lutfen cikis-giris yapip tekrar dene.");
      }
      const res = await fetch('/api/twelve/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ exchange: 'XIST', withPrices: tdWithPrices, limit: tdLimit, offset: tdOffset }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      await onDone();
      alert(`Twelve Data import tamamlandi. Yazilan: ${data.written}, Fiyat cekilen: ${data.priced}, Fiyat hatasi: ${data.failedPrices}`);
      onClose();
    } catch (e) {
      console.error(e);
      alert(`Twelve Data import basarisiz: ${String((e as any)?.message || e)}`);
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] overflow-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="relative min-h-full flex justify-center items-start p-4 md:p-8">
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 10 }}
          className="relative w-full max-w-3xl max-h-[90vh] bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col"
        >
          <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
            <div>
              <h2 className="text-lg font-black text-white">Hisseleri DB&apos;ye Yukle</h2>
              <p className="text-xs text-zinc-500 font-bold">CSV ile ticker + isim import eder. Istersen fiyatlari da bir defa ceker.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 overflow-auto">
            <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-800 w-fit">
              <button
                onClick={() => setTab('twelve')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'twelve' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}
              >
                Twelve Data
              </button>
              <button
                onClick={() => setTab('csv')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'csv' ? 'bg-blue-500 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                CSV
              </button>
            </div>

            {tab === 'twelve' && (
              <div className="p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">XIST Tum Liste (Twelve Data)</div>
                <div className="text-xs text-zinc-400 font-bold">Limit/offset ile parca parca cekebilirsin (gunluk 800 cagri limiti var).</div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 text-xs text-zinc-400 font-bold">
                    <input
                      type="checkbox"
                      checked={tdWithPrices}
                      onChange={(e) => setTdWithPrices(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-500"
                    />
                    Fiyatlari da cek
                  </label>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Limit</div>
                    <input
                      type="number"
                      value={tdLimit}
                      onChange={(e) => setTdLimit(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Offset</div>
                    <input
                      type="number"
                      value={tdOffset}
                      onChange={(e) => setTdOffset(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                </div>

                <button
                  onClick={runTwelve}
                  disabled={isRunning}
                  className={`mt-4 w-full px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${isRunning ? 'opacity-50 cursor-not-allowed bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'}`}
                >
                  <RefreshCcw className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
                  {isRunning ? 'Cekiliyor...' : 'XIST Import Et'}
                </button>

                <button
                  onClick={async () => {
                    setIsRunning(true);
                    try {
                      const { auth } = await import("@/lib/firebase");
                      const token = await auth?.currentUser?.getIdToken?.();
                      if (!token) {
                        throw new Error("Oturum tokeni alinmadi. Lutfen cikis-giris yapip tekrar dene.");
                      }
                      const res = await fetch('/api/twelve/import_all', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ exchange: 'XIST' }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                      await onDone();
                      alert(`Baseline import tamamlandi. Yazilan: ${data.written}`);
                      onClose();
                    } catch (e) {
                      console.error(e);
                      alert(`Baseline import basarisiz: ${String((e as any)?.message || e)}`);
                    } finally {
                      setIsRunning(false);
                    }
                  }}
                  disabled={isRunning}
                  className={`mt-3 w-full px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${isRunning ? 'opacity-50 cursor-not-allowed bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-200 border border-zinc-800'}`}
                >
                  {isRunning ? 'Cekiliyor...' : "1 Defa: Tum XIST Listeyi DB'ye Yaz (Dayanak)"}
                </button>
              </div>
            )}

            {tab === 'csv' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">CSV Formati</div>
                  <div className="text-xs text-zinc-400 font-bold">`TICKER,NAME` (virgul) veya `TICKER;NAME` (noktalı virgul) kabul.</div>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 cursor-pointer flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Dosya Sec
                      <input type="file" accept={".csv,text/csv"} className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
                    </label>
                    <div className="text-xs text-zinc-500 font-bold truncate">{fileName || "Dosya secilmedi"}</div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-zinc-400 font-bold">
                  <input
                    type="checkbox"
                    checked={fetchPrices}
                    onChange={(e) => setFetchPrices(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  Import sirasinda son fiyatlari da cek (yavas olabilir)
                </label>

                <div className="text-xs text-zinc-500 font-bold">
                  Dosyadaki satir: {rows.length} | Yeni eklenecek: {newRows.length}
                </div>

                {progress && (
                  <div className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Calisiyor: {progress.done}/{progress.total} | OK: {progress.ok} | FAIL: {progress.fail}
                  </div>
                )}

                <button
                  onClick={run}
                  disabled={isRunning}
                  className={`w-full px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${isRunning ? 'opacity-50 cursor-not-allowed bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'}`}
                >
                  <RefreshCcw className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
                  {isRunning ? "Import Ediliyor..." : "DB&apos;ye Yaz"}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
