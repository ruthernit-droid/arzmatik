"use client";

import { useState, useEffect, useCallback } from "react";
import { portfolioService } from "@/lib/services/portfolio-service";
import type { PortfolioItem, Participation, IPO, Account } from "@/types";

export function usePortfolio(userId: string | undefined, accountIds: string[], ipos: IPO[]) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || accountIds.length === 0) {
      setPortfolio([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await portfolioService.calculatePortfolio(userId, accountIds, ipos);
      setPortfolio(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, [userId, accountIds.join(','), ipos.length]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addHolding = async (
    accountId: string,
    ipoId: string,
    lots: number,
    purchaseType: 'ipo' | 'portfolio',
    lotPrice: number,
    adjustCash?: boolean
  ) => {
    if (!userId) return;
    await portfolioService.addHolding(userId, accountId, ipoId, lots, purchaseType, lotPrice, adjustCash);
    await refresh();
  };

  const bulkAddHoldings = async (
    ipoId: string,
    items: { accountId: string; lots: number }[],
    purchaseType: 'ipo' | 'portfolio',
    lotPrice: number,
    adjustCash?: boolean
  ) => {
    if (!userId) return;
    await portfolioService.bulkAddHoldings(userId, ipoId, items, purchaseType, lotPrice, adjustCash);
    await refresh();
  };

  const sell = async (
    participationId: string,
    sellData: { accountId: string; sellLots: number; sellPrice: number; currentLots: number }[]
  ) => {
    if (!userId) return;
    await portfolioService.sell(userId, participationId, sellData);
    await refresh();
  };

  const cleanup = async () => {
    if (!userId) return;
    await portfolioService.cleanup(userId, ipos);
    await refresh();
  };

  const getParticipationsForIPO = async (ipoId: string, ticker?: string) => {
    if (!userId) return [];
    return portfolioService.getForIPO(userId, accountIds, ipoId, ticker);
  };

  return {
    portfolio,
    loading,
    error,
    refresh,
    addHolding,
    bulkAddHoldings,
    sell,
    cleanup,
    getParticipationsForIPO,
  };
}
