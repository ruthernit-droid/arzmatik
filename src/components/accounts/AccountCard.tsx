"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink, Pencil, Trash2, MoreVertical } from "lucide-react";
import { BANKS, getBankLoginUrl } from "@/constants/banks";

interface AccountCardProps {
  account: {
    id: string;
    ownerName: string;
    bankName: string;
    accountNumber: string;
    password: string;
    cashBalance?: number;
    bankId?: string;
    notes?: string;
    isAvailableForIPO?: boolean;
    participationNote?: string;
  };
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const bankLoginUrl = account.bankId ? getBankLoginUrl(account.bankId) : 
    BANKS.find(b => b.name.toLowerCase().includes(account.bankName?.toLowerCase() || ""))?.loginUrl || "";

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-sm">
            {account.ownerName?.slice(0, 2).toUpperCase() || "HK"}
          </div>
          <div>
            <p className="font-bold text-sm">{account.ownerName}</p>
            <p className="text-xs text-zinc-500">{account.bankName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-2 mb-3">
        <div 
          className="flex items-center justify-between p-2 bg-zinc-950 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors"
          onClick={() => copyToClipboard(account.accountNumber, "account")}
        >
          <span className="text-xs text-zinc-500">Hesap No</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono">{account.accountNumber}</span>
            {copiedField === "account" ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-500" />
            )}
          </div>
        </div>

        <div 
          className="flex items-center justify-between p-2 bg-zinc-950 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors"
          onClick={() => copyToClipboard(account.password, "password")}
        >
          <span className="text-xs text-zinc-500">Parola</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono">
              {account.password ? "••••••••" : "-"}
            </span>
            {copiedField === "password" ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-500" />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
        <div className="text-xs">
          <span className="text-zinc-500">Bakiye: </span>
          <span className="font-bold text-emerald-400">
            {Number(account.cashBalance || 0).toLocaleString("tr-TR")} TL
          </span>
        </div>

        <div className="flex items-center gap-2">
          {bankLoginUrl && (
            <a
              href={bankLoginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Giriş
            </a>
          )}
        </div>
      </div>

      {/* Notes */}
      {account.participationNote && (
        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-[10px] text-amber-400 font-bold">{account.participationNote}</p>
        </div>
      )}
    </div>
  );
}
