"use client";

import React, { useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import AccountModal from "@/components/AccountModal";
import AccountOperationPanel from "@/components/AccountOperationPanel";
import AccountCard from "@/components/accounts/AccountCard";
import { deleteAccount, saveAccount } from "@/lib/data-service";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";

export default function AccountsPage() {
  const { accounts, user, refreshData } = useFirebaseDataContext();
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [operatingAccount, setOperatingAccount] = useState<any | null>(null);

  const activeCount = useMemo(() => accounts.filter((a: any) => a.isActive).length, [accounts]);
  const passiveCount = accounts.length - activeCount;

  const onSaveAccount = async (data: any) => {
    if (!user) return;
    await saveAccount(user.uid, data);
    setShowAccountModal(false);
    setEditingAccount(null);
    await refreshData();
  };

  const onDeleteAccount = async (id: string) => {
    if (!user) return;
    if (!confirm("Bu hesabi silmek istiyor musun?")) return;
    await deleteAccount(user.uid, id);
    setShowAccountModal(false);
    setEditingAccount(null);
    await refreshData();
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Hesaplar</h2>
          <button
            onClick={() => {
              setEditingAccount(null);
              setShowAccountModal(true);
            }}
            className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-sm bg-emerald-600 text-white"
          >
            <PlusCircle className="w-4 h-4" /> Yeni
          </button>
        </div>
        
        <div className="flex gap-2">
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Aktif: {activeCount}
          </span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-500">
            Pasif: {passiveCount}
          </span>
        </div>
      </div>

      {/* Account Cards - Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-10 text-zinc-500">
          <p className="font-medium">Hesap yok</p>
          <p className="text-sm mt-1">Yukaridaki butondan ekle</p>
        </div>
      )}

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

      {operatingAccount && (
        <AccountOperationPanel
          account={operatingAccount}
          onClose={() => setOperatingAccount(null)}
          onSave={refreshData}
        />
      )}
    </div>
  );
}
