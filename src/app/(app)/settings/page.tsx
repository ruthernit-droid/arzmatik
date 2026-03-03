"use client";

import React, { useState, useEffect } from "react";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { BANKS, Bank } from "@/constants/banks";
import { Moon, Sun, Trash2, Plus, Edit2, Check, X } from "lucide-react";
import { AnimatePresence } from "framer-motion";

interface CustomBank extends Bank {
  isCustom?: boolean;
}

export default function SettingsPage() {
  const { darkMode, toggleTheme, user } = useFirebaseDataContext();
  const [customBanks, setCustomBanks] = useState<CustomBank[]>([]);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [editingBank, setEditingBank] = useState<Partial<Bank>>({});
  const [defaultLots, setDefaultLots] = useState("100");
  const [defaultStatus, setDefaultStatus] = useState("Talepte");

  useEffect(() => {
    const saved = localStorage.getItem("customBanks");
    if (saved) {
      setCustomBanks(JSON.parse(saved));
    }
    const savedLots = localStorage.getItem("defaultLots");
    if (savedLots) setDefaultLots(savedLots);
    const savedStatus = localStorage.getItem("defaultStatus");
    if (savedStatus) setDefaultStatus(savedStatus);
  }, []);

  const allBanks = [...BANKS, ...customBanks];

  const saveCustomBank = () => {
    if (!editingBank.name || !editingBank.loginUrl) return;
    
    const newBank: CustomBank = {
      id: editingBank.id || `custom_${Date.now()}`,
      name: editingBank.name,
      shortName: editingBank.shortName || editingBank.name.slice(0, 8),
      loginUrl: editingBank.loginUrl,
      isCustom: true,
    };

    const updated = [...customBanks, newBank];
    setCustomBanks(updated);
    localStorage.setItem("customBanks", JSON.stringify(updated));
    setIsEditingBank(false);
    setEditingBank({});
  };

  const deleteCustomBank = (id: string) => {
    if (!confirm("Bu bankayı silmek istiyor musunuz?")) return;
    const updated = customBanks.filter(b => b.id !== id);
    setCustomBanks(updated);
    localStorage.setItem("customBanks", JSON.stringify(updated));
  };

  const saveDefaults = () => {
    localStorage.setItem("defaultLots", defaultLots);
    localStorage.setItem("defaultStatus", defaultStatus);
    alert("Varsayılanlar kaydedildi!");
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-black">Ayarlar</h1>
        <p className="text-zinc-500 font-bold text-sm">Uygulama ayarlarınızı buradan yönetin</p>
      </div>

      {/* Tema Ayarları */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
        <h2 className="text-lg font-black mb-4">Görünüm</h2>
        
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full p-4 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
            <span className="font-bold">{darkMode ? "Açık Tema" : "Koyu Tema"}</span>
          </div>
          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
        </button>
      </section>

      {/* Varsayılan Değerler */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
        <h2 className="text-lg font-black mb-4">Varsayılan Değerler</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Varsayılan Lot Miktarı
            </label>
            <input
              type="number"
              value={defaultLots}
              onChange={(e) => setDefaultLots(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Varsayılan Durum
            </label>
            <select
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold outline-none focus:border-emerald-500"
            >
              <option>Bekliyor</option>
              <option>Talepte</option>
              <option>Dağıtıldı</option>
              <option>İptal</option>
            </select>
          </div>

          <button
            onClick={saveDefaults}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-colors"
          >
            Kaydet
          </button>
        </div>
      </section>

      {/* Banka Yönetimi */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black">Banka Yönetimi</h2>
          <button
            onClick={() => {
              setEditingBank({});
              setIsEditingBank(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Ekle
          </button>
        </div>

        {/* Banka Listesi */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {allBanks.map((bank) => (
            <div
              key={bank.id}
              className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800"
            >
              <div>
                <p className="font-bold">{bank.name}</p>
                <p className="text-xs text-zinc-500">{bank.loginUrl}</p>
              </div>
              {bank.isCustom && (
                <button
                  onClick={() => deleteCustomBank(bank.id)}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Yeni Banka Ekleme Modal */}
        <AnimatePresence>
          {isEditingBank && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-lg font-black mb-4">Yeni Banka Ekle</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                      Banka Adı
                    </label>
                    <input
                      type="text"
                      value={editingBank.name || ""}
                      onChange={(e) => setEditingBank({ ...editingBank, name: e.target.value })}
                      placeholder="Ör: Yeni Banka"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                      Kısa Ad
                    </label>
                    <input
                      type="text"
                      value={editingBank.shortName || ""}
                      onChange={(e) => setEditingBank({ ...editingBank, shortName: e.target.value })}
                      placeholder="Ör: YeniBanka"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                      Giriş Linki
                    </label>
                    <input
                      type="url"
                      value={editingBank.loginUrl || ""}
                      onChange={(e) => setEditingBank({ ...editingBank, loginUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setIsEditingBank(false)}
                      className="flex-1 py-3 border border-zinc-700 text-zinc-400 rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      onClick={saveCustomBank}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-colors"
                    >
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </section>

      {/* Hesap Bilgileri */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
        <h2 className="text-lg font-black mb-4">Hesap</h2>
        
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <span className="text-emerald-400 font-bold">
                  {user.displayName?.[0] || user.email?.[0] || "U"}
                </span>
              </div>
              <div>
                <p className="font-bold">{user.displayName || "Kullanıcı"}</p>
                <p className="text-xs text-zinc-500">{user.email}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-zinc-500">Giriş yapılmamış</p>
        )}
      </section>
    </div>
  );
}
