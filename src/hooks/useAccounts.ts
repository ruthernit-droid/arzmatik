"use client";

import { useState, useEffect, useCallback } from "react";
import { accountService } from "@/lib/services/account-service";
import type { Account } from "@/types";

export function useAccounts(userId: string | undefined) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await accountService.getAll(userId);
      setAccounts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveAccount = async (account: Account) => {
    if (!userId) return;
    await accountService.save(userId, account);
    await refresh();
  };

  const deleteAccount = async (id: string) => {
    if (!userId) return;
    await accountService.delete(userId, id);
    await refresh();
  };

  return {
    accounts,
    loading,
    error,
    refresh,
    saveAccount,
    deleteAccount,
  };
}
