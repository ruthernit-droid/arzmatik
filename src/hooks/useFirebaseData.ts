"use client";

import { useState, useEffect } from "react";
import { getIPOs, getAccounts, saveAccount, saveIPO, getUserPortfolio } from "@/lib/data-service";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";

export function useFirebaseData() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [ipos, setIpos] = useState<any[]>([]);
    const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [darkMode, setDarkMode] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "light") {
            setDarkMode(false);
            document.documentElement.classList.add("light");
        } else {
            document.documentElement.classList.remove("light");
        }
    }, []);

    const toggleTheme = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        if (newMode) {
            document.documentElement.classList.remove("light");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.add("light");
            localStorage.setItem("theme", "light");
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                loadData(currentUser.uid);
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const loadData = async (uid: string) => {
        try {
            setLoading(true);
            const [rawIpos, rawAccounts] = await Promise.all([
                getIPOs(),
                getAccounts(uid)
            ]);

            // Silent Migration for IPOs: ensure createdAt and companyName
            const migratedIpoResults = await Promise.all(rawIpos.map(async (ipoItem: any) => {
                let ipo = ipoItem;
                const needsNameMigration = ipo.name && !ipo.companyName;
                const needsDateMigration = false;

                if (needsNameMigration || needsDateMigration) {
                    try {
                        console.log("Migrating IPO:", ipo.id);
                        const migratedIpo = {
                            ...ipo,
                            companyName: ipo.companyName || ipo.name || 'Bilinmeyen Şirket',
                            createdAt: ipo.createdAt || ipo.updatedAt || new Date().toISOString()
                        };
                        await saveIPO(migratedIpo);
                        ipo = migratedIpo;
                    } catch (e) {
                        console.error("IPO migration failed:", e);
                    }
                }
                return ipo;
            }));

            const fetchedIpos = migratedIpoResults.sort((a: any, b: any) => {
                const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return (a.companyName || "").localeCompare(b.companyName || "");
            });

            const ipoById = new Map<string, any>((fetchedIpos as any[]).map(i => [i.id, i]));
            const ipoByTicker = new Map<string, any>((fetchedIpos as any[])
                .filter(i => i?.ticker)
                .map(i => [String(i.ticker).toUpperCase(), i]));

            const portfolio = await getUserPortfolio(uid, fetchedIpos as any[]);
            setPortfolioItems(portfolio);

            // For each account, fetch its participations to aggregate stats
            const fetchedAccounts = await Promise.all(rawAccounts.map(async (accountItem: any) => {
                let acc = accountItem;

                // Silent Migration: Standardize old fields to new system
                const needsOwnerMigration = acc.name && !acc.ownerName;
                const needsBankMigration = acc.bank && !acc.bankName;
                const needsCashMigration = acc.cash !== undefined && acc.cashBalance === undefined;
                const needsIdMigration = (acc.tckn || acc.tcKimlik || acc.tcNo || acc.kimlikNo) && !acc.idNo;
                const needsCustomerMigration = (acc.customerNo || acc.musteriNo || acc.hesapNo) && !acc.accountNumber;
                const needsPassMigration = (acc.sifre || acc.pin || acc.pass) && !acc.password;

                if (needsOwnerMigration || needsBankMigration || needsCashMigration || needsIdMigration || needsCustomerMigration || needsPassMigration) {
                    try {
                        console.log("Migrating account detailed:", acc.id);
                        const migratedAcc = {
                            ...acc,
                            ownerName: acc.ownerName || acc.name || 'İsimsiz',
                            bankName: acc.bankName || acc.bank || 'Bilinmeyen Banka',
                            cashBalance: Number(acc.cashBalance !== undefined ? acc.cashBalance : (acc.cash || 0)),
                            idNo: acc.idNo || acc.tckn || acc.tcKimlik || acc.tcNo || acc.kimlikNo || '',
                            accountNumber: acc.accountNumber || acc.customerNo || acc.musteriNo || acc.hesapNo || '',
                            password: acc.password || acc.sifre || acc.pin || acc.pass || ''
                        };
                        // Save to DB to finalize migration
                        await saveAccount(uid, migratedAcc);
                        acc = migratedAcc;
                    } catch (e) {
                        console.error("Account migration failed:", e);
                    }
                }

                const participationsRef = collection(db, `users/${uid}/accounts/${acc.id}/participations`);
                const pSnap = await getDocs(participationsRef);

                let totalDemand = 0;
                let totalStocks = 0;

                pSnap.docs.forEach(d => {
                    const data = d.data();
                    const key = String(d.id || "");
                    const ipo = ipoById.get(key) || ipoByTicker.get(key.toUpperCase());
                    if (!ipo) return;

                    const price = Number(ipo.price || 0);
                    const lotPrice = Number((data as any).lotPrice || price);
                    if (data.status === 'Talepte') {
                        totalDemand += (Number(data.requestedLots || 0) * lotPrice);
                    } else if (data.status === 'Dağıtıldı' || data.status === 'Satıldı') {
                        // For cost basis, use allotted lots. If sold, it might be 0 but usually held stocks reflect cost
                        totalStocks += (Number(data.allottedLots || 0) * price);
                    }
                });

                return {
                    ...acc,
                    demand: totalDemand,
                    stocks: totalStocks
                };
            }));

            setIpos(fetchedIpos);
            setAccounts(fetchedAccounts);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const refreshData = () => user && loadData(user.uid);

    return {
        accounts,
        ipos,
        portfolioItems,
        loading,
        user,
        darkMode,
        toggleTheme,
        refreshData
    };
}
