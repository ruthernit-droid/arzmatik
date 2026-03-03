"use client";

import { useState, useEffect, useCallback } from "react";
import { ipoService } from "@/lib/services/ipo-service";
import type { IPO } from "@/types";

export function useIPOs() {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipoService.getAll();
      setIpos(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load IPOs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveIpo = async (ipo: IPO) => {
    await ipoService.save(ipo);
    await refresh();
  };

  const deleteIpo = async (id: string) => {
    await ipoService.delete(id);
    await refresh();
  };

  const updatePrice = async (id: string, price: number) => {
    await ipoService.updatePrice(id, price);
    await refresh();
  };

  return {
    ipos,
    loading,
    error,
    refresh,
    saveIpo,
    deleteIpo,
    updatePrice,
  };
}
