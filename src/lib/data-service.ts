import {
    collection,
    getDocs,
    getDoc,
    deleteDoc,
    updateDoc,
    query,
    doc,
    setDoc,
    orderBy,
    writeBatch,
    increment,
    runTransaction,
    where
} from "firebase/firestore";
import { db } from "./firebase";
import { IPO_STATUSES, getNextStatus, IpoStatus } from "@/constants/ipoStatus";

function upper(s: string | null | undefined) {
    return (s || "").toUpperCase();
}

export const getIPOs = async () => {
    const ipoRef = collection(db, "ipos");
    const q = query(ipoRef, orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getAccounts = async (userId: string) => {
    const accountsRef = collection(db, `users/${userId}/accounts`);
    const querySnapshot = await getDocs(accountsRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveAccount = async (userId: string, account: any) => {
    const accountRef = account.id
        ? doc(db, `users/${userId}/accounts/${account.id}`)
        : doc(collection(db, `users/${userId}/accounts`));

    await setDoc(accountRef, {
        ownerName: account.ownerName || account.name || 'İsimsiz',
        bankName: account.bankName || account.bank || 'Bilinmeyen Banka',
        cashBalance: Number(account.cashBalance !== undefined ? account.cashBalance : (account.cash || 0)),
        accountNumber: account.accountNumber || '',
        idNo: account.idNo || '',
        password: account.password || '',
        notes: account.notes || '',
        isActive: account.isActive ?? true,
        updatedAt: new Date().toISOString()
    }, { merge: true });
};

export const deleteAccount = async (userId: string, accountId: string) => {
    const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
    await deleteDoc(accountRef);
};

export const saveIPO = async (ipo: any): Promise<string> => {
    // Check for duplicate ticker if creating new IPO
    if (!ipo.id && ipo.ticker) {
        const q = query(collection(db, "ipos"), where("ticker", "==", ipo.ticker.toUpperCase()));
        const existing = await getDocs(q);
        if (!existing.empty) {
            // Update existing IPO instead of creating duplicate
            const existingDoc = existing.docs[0];
            console.log(`Duplicate IPO detected for ticker ${ipo.ticker}, updating existing record ${existingDoc.id}`);
            ipo.id = existingDoc.id;
        }
    }

    const ipoRef = ipo.id
        ? doc(db, "ipos", ipo.id)
        : doc(collection(db, "ipos"));

    const data: any = {
        companyName: ipo.companyName || ipo.name || 'Bilinmeyen Şirket',
        ticker: ipo.ticker || '',
        price: Number(ipo.price || 0),
        ipoPrice: Number(ipo.ipoPrice ?? ipo.price ?? 0),
        totalOfferedLots: Number(ipo.totalOfferedLots || 0),
        status: ipo.status || 'duyuru',
        // Date fields
        announcementDate: ipo.announcementDate || null,
        applicationStartDate: ipo.applicationStartDate || null,
        applicationEndDate: ipo.applicationEndDate || null,
        demandEndDate: ipo.demandEndDate ? `${ipo.demandEndDate}T${ipo.demandEndTime || '17:00'}:00` : null,
        demandEndTime: ipo.demandEndTime || "17:00",
        allocationDate: ipo.allocationDate || null,
        resultDate: ipo.resultDate || null,
        listingDate: ipo.listingDate || null,
        updatedAt: new Date().toISOString(),
        ...(ipo.price !== undefined && ipo.price !== null ? { priceUpdatedAt: new Date().toISOString() } : {}),
    };

    if (!ipo.id) {
        data.createdAt = new Date().toISOString();
    }

    await setDoc(ipoRef, data, { merge: true });

    return ipoRef.id;
};

export const addHoldingToAccount = async (
    userId: string,
    accountId: string,
    ipoId: string,
    lots: number,
    purchaseType: 'ipo' | 'portfolio',
    lotPrice: number,
    adjustCash: boolean = true
) => {
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
};

export const cleanupUserData = async (userId: string, ipos: any[] = []) => {
    const ipoById = new Map<string, any>(ipos.map((i: any) => [i.id, i]));
    const ipoIdByTicker = new Map<string, string>(ipos
        .filter((i: any) => i?.ticker)
        .map((i: any) => [upper(i.ticker), i.id]));

    let migrated = 0;
    let deletedEmpty = 0;

    const accountsSnap = await getDocs(collection(db, `users/${userId}/accounts`));
    for (const accDoc of accountsSnap.docs) {
        const accId = accDoc.id;
        const pRef = collection(db, `users/${userId}/accounts/${accId}/participations`);
        const pSnap = await getDocs(pRef);

        for (const pDoc of pSnap.docs) {
            const id = pDoc.id;
            const data: any = pDoc.data();

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
};

export async function deleteIPO(id: string) {
    await deleteDoc(doc(db, 'ipos', id));
}

export async function updateIpoPrice(id: string, newPrice: number) {
    await updateDoc(doc(db, 'ipos', id), {
        price: newPrice,
        priceUpdatedAt: new Date().toISOString(),
    });
}

export const bulkAddHoldingToAccounts = async (
    userId: string,
    ipoId: string,
    items: { accountId: string; lots: number }[],
    purchaseType: 'ipo' | 'portfolio',
    lotPrice: number,
    adjustCash: boolean = true
) => {
    const safePrice = Number(lotPrice || 0);
    if (safePrice <= 0) return;

    for (const item of items) {
        const safeLots = Number(item.lots || 0);
        if (!item.accountId || safeLots <= 0) continue;
        await addHoldingToAccount(userId, item.accountId, ipoId, safeLots, purchaseType, safePrice, adjustCash);
    }
};

export const processBatchOperation = async (
    userId: string,
    ipoId: string,
    ipoPrice: number,
    updatedAccounts: any[],
    mode: 'talep' | 'dagitim'
) => {
    const batch = writeBatch(db);

    for (const acc of updatedAccounts) {
        let newCash = Number(acc.cashBalance || acc.cash || 0);

        const currentRequested = Number(acc.requestedLots || 0);
        const originalRequested = Number(acc.originalRequestedLots || 0);
        const currentAllotted = Number(acc.allottedLots || 0);
        const originalAllotted = Number(acc.originalAllottedLots || 0);

        if (mode === 'talep') {
            const delta = (originalRequested - currentRequested) * ipoPrice;
            newCash += delta;
        } else if (mode === 'dagitim') {
            const oldRefund = (originalRequested - originalAllotted) * ipoPrice;
            const newRefund = (currentRequested - currentAllotted) * ipoPrice;
            const delta = newRefund - oldRefund;
            newCash += delta;
        }

        const accountRef = doc(db, `users/${userId}/accounts/${acc.id}`);
        batch.set(accountRef, { cashBalance: newCash }, { merge: true });

        const participationRef = doc(db, `users/${userId}/accounts/${acc.id}/participations/${ipoId}`);
        const existingSnap = await getDoc(participationRef);
        const existingLots = Number(existingSnap.data()?.allottedLots || 0);
        const existingLotPrice = Number(existingSnap.data()?.lotPrice || ipoPrice || 0);

        let computedLotPrice = existingLotPrice || Number(ipoPrice || 0);
        if (!existingSnap.exists() && currentAllotted > 0) {
            computedLotPrice = Number(ipoPrice || 0);
        }

        if (mode === 'dagitim' && currentAllotted > originalAllotted) {
            const addedLots = currentAllotted - originalAllotted;
            const baseLots = Math.max(0, existingLots);
            const totalLots = Math.max(0, baseLots + addedLots);
            if (totalLots > 0) {
                computedLotPrice = ((baseLots * existingLotPrice) + (addedLots * Number(ipoPrice || 0))) / totalLots;
            }
        }

        batch.set(participationRef, {
            requestedLots: currentRequested,
            allottedLots: currentAllotted,
            status: acc.status,
            purchaseType: acc.purchaseType || 'ipo',
            lotPrice: computedLotPrice,
            notes: acc.notes || '',
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
};

export const sellParticipations = async (
    userId: string,
    participationId: string,
    sellData: { accountId: string; sellLots: number; sellPrice: number; currentLots: number }[]
) => {
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
};

export const getParticipationsForIPO = async (userId: string, accountIds: string[], ipoId: string, ticker?: string) => {
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
        // Silent migration: normalize legacy ticker-keyed docs to ipoId-keyed docs.
        await setDoc(canonicalRef, legacyData, { merge: true });
        await deleteDoc(legacyRef);
        return { accountId: accId, id: ipoId, ...legacyData };
    });

    const settled = await Promise.allSettled(tasks);
    return settled
        .filter(r => r.status === 'fulfilled')
        .map((r: any) => r.value)
        .filter(Boolean);
};

export const getUserPortfolio = async (userId: string, ipos: any[] = []) => {
    const accountsRef = collection(db, `users/${userId}/accounts`);
    const accountsSnap = await getDocs(accountsRef);

    const ipoById = new Map<string, any>(ipos.map((i: any) => [i.id, i]));
    const ipoIdByTicker = new Map<string, string>(ipos
        .filter((i: any) => i?.ticker)
        .map((i: any) => [upper(i.ticker), i.id]));

    const portfolioMap: Record<string, { ipoId: string; ticker: string; totalLots: number; totalCost: number; types: Set<string> }> = {};

    for (const accDoc of accountsSnap.docs) {
        const pRef = collection(db, `users/${userId}/accounts/${accDoc.id}/participations`);
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
};

export const advanceIpoStatus = async (ipoId: string): Promise<{ success: boolean; newStatus: string | null; error?: string }> => {
    try {
        const ipoRef = doc(db, "ipos", ipoId);
        const ipoSnap = await getDoc(ipoRef);
        
        if (!ipoSnap.exists()) {
            return { success: false, newStatus: null, error: "IPO bulunamadı" };
        }
        
        const ipoData = ipoSnap.data();
        const currentStatus = ipoData?.status;
        
        // Find current status in our new IPO_STATUSES
        const currentStatusObj = IPO_STATUSES.find(s => s.id === currentStatus || s.label === currentStatus);
        
        if (!currentStatusObj) {
            return { success: false, newStatus: null, error: "Geçerli bir durum bulunamadı" };
        }
        
        const nextStatus = getNextStatus(currentStatusObj.id as IpoStatus);
        
        if (!nextStatus) {
            return { success: false, newStatus: null, error: "Son duruma ulaşıldı, ilerletilemez" };
        }
        
        const nextStatusInfo = IPO_STATUSES.find(s => s.id === nextStatus);
        
        await updateDoc(ipoRef, {
            status: nextStatus,
            statusUpdatedAt: new Date().toISOString()
        });

        // Send notification (fire and forget, don't await)
        if (typeof window !== "undefined") {
            import("@/lib/notifications").then(({ notifyIpoStatusChange }) => {
                notifyIpoStatusChange(ipoData?.companyName || ipoData?.ticker || "IPO", currentStatusObj.label, nextStatusInfo?.label || nextStatus).catch(console.error);
            }).catch(console.error);
        }
        
        return { success: true, newStatus: nextStatusInfo?.label || nextStatus };
    } catch (error) {
        console.error("Error advancing IPO status:", error);
        return { success: false, newStatus: null, error: String(error) };
    }
};

export const updateIpoStatus = async (ipoId: string, newStatus: string): Promise<void> => {
    const ipoRef = doc(db, "ipos", ipoId);
    await updateDoc(ipoRef, {
        status: newStatus,
        statusUpdatedAt: new Date().toISOString()
    });
};

// Auto-check and advance IPO status based on dates
export const checkAndAdvanceIpoStatus = async (ipo: any): Promise<{ advanced: boolean; newStatus: string | null }> => {
    const now = new Date();
    const currentStatus = ipo.status;
    
    // Date-based status transitions
    const statusTransitions: Record<string, { dateField: string; nextStatus: string; dateField2?: string; nextStatus2?: string }> = {
        "duyuru": { dateField: "announcementDate", nextStatus: "basvuru_acik" },
        "basvuru_acik": { dateField: "applicationStartDate", nextStatus: "talep_toplaniyor" },
        "talep_toplaniyor": { dateField: "demandEndDate", nextStatus: "talep_kapandi" },
        "talep_kapandi": { dateField: "allocationDate", nextStatus: "tahsis" },
        "tahsis": { dateField: "resultDate", nextStatus: "sonuclar" },
        "sonuclar": { dateField: "listingDate", nextStatus: "listeleme" },
    };
    
    const transition = statusTransitions[currentStatus];
    if (!transition) {
        return { advanced: false, newStatus: null };
    }
    
    const dateValue = ipo[transition.dateField];
    if (!dateValue) {
        return { advanced: false, newStatus: null };
    }
    
    const targetDate = new Date(dateValue);
    
    // Check if it's time to advance (allow 1 hour buffer after the time)
    const bufferTime = 60 * 60 * 1000; // 1 hour in ms
    if (now.getTime() >= targetDate.getTime() - bufferTime) {
        // Check if already at this status
        if (currentStatus === transition.nextStatus) {
            return { advanced: false, newStatus: null };
        }
        
        await updateDoc(doc(db, "ipos", ipo.id), {
            status: transition.nextStatus,
            statusUpdatedAt: new Date().toISOString()
        });
        
        return { advanced: true, newStatus: transition.nextStatus };
    }
    
    return { advanced: false, newStatus: null };
};

// Check all IPOs and advance if needed
export const checkAllIposAndAdvance = async (): Promise<{ checked: number; advanced: number }> => {
    const ipos = await getIPOs();
    let advanced = 0;
    
    for (const ipo of ipos) {
        const result = await checkAndAdvanceIpoStatus(ipo);
        if (result.advanced) {
            advanced++;
        }
    }
    
    return { checked: ipos.length, advanced };
};

// Move IPO to stocks when listed
export const moveIpoToStocks = async (ipo: any): Promise<void> => {
    if (ipo.status !== "listeleme" && ipo.status !== "Listeleme") {
        return;
    }
    
    // Check if already in stocks
    const stocksRef = collection(db, "stocks");
    const q = query(stocksRef, where("ticker", "==", upper(ipo.ticker)));
    const existing = await getDocs(q);
    
    if (existing.empty) {
        // Add to stocks
        const stockRef = doc(stocksRef);
        await setDoc(stockRef, {
            ticker: upper(ipo.ticker),
            name: ipo.companyName,
            price: ipo.price,
            previousClose: ipo.price,
            change: 0,
            changePercent: 0,
            volume: 0,
            marketCap: 0,
            source: "auto-listed",
            listedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
    }
};
