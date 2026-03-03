import {
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  doc,
  setDoc,
  writeBatch,
  increment,
  runTransaction
} from "firebase/firestore";
import { db } from "../firebase";
import type { Participation, PortfolioItem, IPO } from "@/types";

function upper(s: string | null | undefined) {
  return (s || "").toUpperCase();
}

export const portfolioService = {
  async getParticipations(userId: string, accountId: string): Promise<Participation[]> {
    const pRef = collection(db, `users/${userId}/accounts/${accountId}/participations`);
    const pSnap = await getDocs(pRef);
    return pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Participation[];
  },

  async getAllParticipations(userId: string, accountIds: string[]): Promise<Participation[]> {
    const all: Participation[] = [];
    for (const accId of accountIds) {
      const parts = await this.getParticipations(userId, accId);
      all.push(...parts.map(p => ({ ...p, accountId: accId })));
    }
    return all;
  },

  async getForIPO(userId: string, accountIds: string[], ipoId: string, ticker?: string): Promise<Participation[]> {
    const legacyId = ticker ? upper(ticker) : "";

    const tasks = accountIds.map(async (accId) => {
      const canonicalRef = doc(db, `users/${userId}/accounts/${accId}/participations/${ipoId}`);
      const canonicalSnap = await getDoc(canonicalRef);
      if (canonicalSnap.exists()) {
        return { accountId: accId, id: ipoId, ...canonicalSnap.data() };
      }

      if (!legacyId) return null;

      const legacyRef = doc(db, `users/${userId}/accounts/${accId}/participations/${legacyId}`);
      const legacySnap = await getDoc(legacyRef);
      if (!legacySnap.exists()) return null;

      const legacyData = legacySnap.data();
      await setDoc(canonicalRef, legacyData, { merge: true });
      await deleteDoc(legacyRef);
      return { accountId: accId, id: ipoId, ...legacyData };
    });

    const settled = await Promise.allSettled(tasks);
    return settled
      .filter(r => r.status === 'fulfilled')
      .map((r: any) => r.value)
      .filter(Boolean) as Participation[];
  },

  async calculatePortfolio(userId: string, accountIds: string[], ipos: IPO[]): Promise<PortfolioItem[]> {
    const ipoById = new Map<string, IPO>(ipos.map((i) => [i.id!, i]));
    const ipoIdByTicker = new Map<string, string>(ipos
      .filter((i) => i?.ticker)
      .map((i) => [upper(i.ticker), i.id!]));

    const portfolioMap: Record<string, { ipoId: string; ticker: string; totalLots: number; totalCost: number; types: Set<string> }> = {};

    for (const accId of accountIds) {
      const pRef = collection(db, `users/${userId}/accounts/${accId}/participations`);
      const pSnap = await getDocs(pRef);

      pSnap.forEach(pDoc => {
        const pData = pDoc.data();
        const lots = Number(pData.allottedLots || 0);
        if (lots > 0) {
          const rawId = pDoc.id;
          const resolvedIpoId = ipoById.has(rawId) ? rawId : (ipoIdByTicker.get(upper(rawId)) || rawId);
          const ipo = ipoById.get(resolvedIpoId);
          const ticker = ipo?.ticker ? upper(ipo.ticker) : upper(rawId);
          const lotPrice = Number(pData.lotPrice || ipo?.price || 0);

          if (!portfolioMap[resolvedIpoId]) {
            portfolioMap[resolvedIpoId] = { ipoId: resolvedIpoId, ticker, totalLots: 0, totalCost: 0, types: new Set() };
          }
          portfolioMap[resolvedIpoId].totalLots += lots;
          portfolioMap[resolvedIpoId].totalCost += (lots * lotPrice);
          portfolioMap[resolvedIpoId].types.add(pData.purchaseType || 'ipo');
        }
      });
    }

    return Object.values(portfolioMap).map(item => ({
      ...item,
      types: Array.from(item.types)
    }));
  },

  async addHolding(
    userId: string,
    accountId: string,
    ipoId: string,
    lots: number,
    purchaseType: 'ipo' | 'portfolio',
    lotPrice: number,
    adjustCash: boolean = true
  ): Promise<void> {
    const safeLots = Number(lots || 0);
    const safePrice = Number(lotPrice || 0);
    if (safeLots <= 0 || safePrice <= 0) return;

    const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
    const participationRef = doc(db, `users/${userId}/accounts/${accountId}/participations/${ipoId}`);

    await runTransaction(db, async (tx) => {
      const [accSnap, pSnap] = await Promise.all([
        tx.get(accountRef),
        tx.get(participationRef),
      ]);

      const currentCash = Number(accSnap.data()?.cashBalance || 0);
      const currentLots = Number(pSnap.data()?.allottedLots || 0);
      const currentLotPrice = Number(pSnap.data()?.lotPrice || safePrice);

      const newLots = currentLots + safeLots;
      const newAvgPrice = newLots > 0
        ? ((currentLots * currentLotPrice) + (safeLots * safePrice)) / newLots
        : safePrice;

      tx.set(accountRef, {
        cashBalance: adjustCash ? (currentCash - (safeLots * safePrice)) : currentCash,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      tx.set(participationRef, {
        requestedLots: 0,
        allottedLots: newLots,
        status: 'Dağıtıldı',
        purchaseType,
        lotPrice: newAvgPrice,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });
  },

  async bulkAddHoldings(
    userId: string,
    ipoId: string,
    items: { accountId: string; lots: number }[],
    purchaseType: 'ipo' | 'portfolio',
    lotPrice: number,
    adjustCash: boolean = true
  ): Promise<void> {
    const safePrice = Number(lotPrice || 0);
    if (safePrice <= 0) return;

    for (const item of items) {
      const safeLots = Number(item.lots || 0);
      if (!item.accountId || safeLots <= 0) continue;
      await this.addHolding(userId, item.accountId, ipoId, safeLots, purchaseType, safePrice, adjustCash);
    }
  },

  async sell(
    userId: string,
    participationId: string,
    sellData: { accountId: string; sellLots: number; sellPrice: number; currentLots: number }[]
  ): Promise<void> {
    const batch = writeBatch(db);

    for (const item of sellData) {
      const saleProceeds = item.sellLots * item.sellPrice;
      const remainingLots = Math.max(0, Number(item.currentLots || 0) - Number(item.sellLots || 0));

      const accountRef = doc(db, `users/${userId}/accounts/${item.accountId}`);
      batch.update(accountRef, {
        cashBalance: increment(saleProceeds)
      });

      const participationRef = doc(db, `users/${userId}/accounts/${item.accountId}/participations/${participationId}`);
      batch.update(participationRef, {
        status: remainingLots <= 0 ? 'Satıldı' : 'Dağıtıldı',
        allottedLots: increment(-item.sellLots),
        sellPrice: item.sellPrice,
        saleDate: new Date().toISOString()
      });
    }

    await batch.commit();
  },

  async cleanup(userId: string, ipos: IPO[] = []): Promise<{ migrated: number; deletedEmpty: number }> {
    const ipoById = new Map<string, IPO>(ipos.map((i) => [i.id!, i]));
    const ipoIdByTicker = new Map<string, string>(ipos
      .filter((i) => i?.ticker)
      .map((i) => [upper(i.ticker), i.id!]));

    let migrated = 0;
    let deletedEmpty = 0;

    const accountsSnap = await getDocs(collection(db, `users/${userId}/accounts`));
    for (const accDoc of accountsSnap.docs) {
      const accId = accDoc.id;
      const pRef = collection(db, `users/${userId}/accounts/${accId}/participations`);
      const pSnap = await getDocs(pRef);

      for (const pDoc of pSnap.docs) {
        const id = pDoc.id;
        const data = pDoc.data();

        const canonicalId = ipoById.has(id) ? id : (ipoIdByTicker.get(upper(id)) || null);
        if (canonicalId && canonicalId !== id) {
          const canonicalRef = doc(db, `users/${userId}/accounts/${accId}/participations/${canonicalId}`);
          await setDoc(canonicalRef, data, { merge: true });
          await deleteDoc(doc(db, `users/${userId}/accounts/${accId}/participations/${id}`));
          migrated++;
          continue;
        }

        const requestedLots = Number(data.requestedLots || 0);
        const allottedLots = Number(data.allottedLots || 0);
        const status = String(data.status || "");
        const notes = String(data.notes || "").trim();
        const hasSales = data.sellPrice !== undefined || data.saleDate !== undefined;

        const isEmptyLots = requestedLots === 0 && allottedLots === 0;
        const isTrivialStatus = status === "" || status === "Bekliyor" || status === "Talepte";

        if (isEmptyLots && isTrivialStatus && !notes && !hasSales) {
          await deleteDoc(doc(db, `users/${userId}/accounts/${accId}/participations/${id}`));
          deletedEmpty++;
        }
      }
    }

    return { migrated, deletedEmpty };
  }
};
