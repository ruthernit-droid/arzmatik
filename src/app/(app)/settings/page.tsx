"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { BANKS, Bank } from "@/constants/banks";
import { Moon, Sun, Trash2, Plus, Edit2, Check, X, Users } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import AccountModal from "@/components/AccountModal";
import AccountCard from "@/components/accounts/AccountCard";
import { deleteAccount, saveAccount, resetUserTradingData } from "@/lib/data-service";

interface CustomBank extends Bank {
  isCustom?: boolean;
}

export default function SettingsPage() {
  const { darkMode, toggleTheme, user, accounts, refreshData } = useFirebaseDataContext();
  const [customBanks, setCustomBanks] = useState<CustomBank[]>([]);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [editingBank, setEditingBank] = useState<Partial<Bank>>({});
  const [defaultLots, setDefaultLots] = useState("100");
  const [defaultStatus, setDefaultStatus] = useState("Talepte");
  
  // Account management state
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isAccountPersisting, setIsAccountPersisting] = useState(false);

  const activeCount = useMemo(() => accounts.filter((a: any) => a.isActive).length, [accounts]);
  const passiveCount = accounts.length - activeCount;

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

  const onSaveAccount = async (data: any) => {
    if (!user) return;

    // Close modal first to avoid UI lock if network stalls.
    setShowAccountModal(false);
    setEditingAccount(null);
    setIsAccountPersisting(true);

    try {
      await Promise.race([
        saveAccount(user.uid, data),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Kaydetme zaman asimina ugradi")), 15000)),
      ]);
      await refreshData();
    } catch (e: any) {
      console.error(e);
      alert(`Hesap kaydedilemedi: ${String(e?.message || e)}`);
    } finally {
      setIsAccountPersisting(false);
    }
  };

  const onDeleteAccount = async (id: string) => {
    if (!user) return;
    if (!confirm("Bu hesabi silmek istiyor musun?")) return;
    await deleteAccount(user.uid, id);
    setShowAccountModal(false);
    setEditingAccount(null);
    await refreshData();
  };

  const handleResetTradingData = async () => {
    if (!user) return;
    const ok = confirm(
      "Tum hesaplardaki bakiyeler 0'lanacak ve alim/satim/talep kayitlari silinecek. Hesap temel bilgileri korunacak. Devam edilsin mi?"
    );
    if (!ok) return;

    try {
      const result = await resetUserTradingData(user.uid);
      await refreshData();
      alert(`Sifirlama tamamlandi. Hesap: ${result.updatedAccounts}, Silinen kayit: ${result.deletedParticipations}`);
    } catch (e) {
      console.error(e);
      alert("Sifirlama sirasinda hata olustu.");
    }
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
              <option>Katılmadı</option>
              <option>Nakit Yetersiz</option>
              <option>Giriş Yapılamıyor</option>
              <option>Ulaşılamıyor</option>
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

      {/* Hesap Yönetimi */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black">Hesap Yönetimi</h2>
          <div className="flex items-center gap-2">
            <Link
              href="/accounts"
              className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-bold hover:bg-zinc-700 transition-colors"
            >
              Tam Ekran
            </Link>
            <button
              onClick={() => {
                setEditingAccount(null);
                setShowAccountModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Ekle
            </button>
          </div>
        </div>

        {isAccountPersisting && (
          <div className="mb-3 text-xs text-amber-400 font-bold">Hesap kaydi isleniyor...</div>
        )}

        <div className="flex gap-2 mb-4">
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Aktif: {activeCount}
          </span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-500">
            Pasif: {passiveCount}
          </span>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {accounts.map((acc: any) => (
            <AccountCard
              key={acc.id}
              account={acc}
              onEdit={() => {
                setEditingAccount(acc);
                setShowAccountModal(true);
              }}
              onDelete={() => onDeleteAccount(acc.id)}
            />
          ))}
          {accounts.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-4">Henüz hesap eklenmemiş</p>
          )}
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingBank(false)}>
              <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
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

      {/* Veri Sifirlama */}
      <section className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-6">
        <h2 className="text-lg font-black mb-2 text-rose-400">Yeni Baslangic</h2>
        <p className="text-xs text-zinc-400 mb-4">
          Hesap temel bilgileri korunur. Bakiyeler sifirlanir, tum talep/alim/satim kayitlari silinir.
        </p>
        <button
          onClick={handleResetTradingData}
          className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-colors"
        >
          Islem Verilerini Sifirla
        </button>
      </section>

      {showAccountModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setShowAccountModal(false);
            setEditingAccount(null);
          }}
          onSave={onSaveAccount}
          onDelete={(id) => onDeleteAccount(id)}
        />
      )}
    </div>
  );
}
