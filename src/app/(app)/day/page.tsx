"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";
import { getParticipationsForIPO, processBatchOperation } from "@/lib/data-service";
import { Save, Check, Copy, ExternalLink, FileDown } from "lucide-react";
import { getBankLoginUrl } from "@/constants/banks";
import { normalizeIpoStatus } from "@/constants/ipoStatuses";

const NON_PARTICIPATION_REASONS = [
  { value: "", label: "Sebep Yok" },
  { value: "cash_insufficient", label: "Nakit Yetersiz" },
  { value: "login_unreachable", label: "Hesaba Ulasilamadi" },
  { value: "login_failed", label: "Giris Yapilamadi" },
  { value: "manual_skip", label: "Kullanici Atladi" },
  { value: "other", label: "Diger" },
] as const;

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  NON_PARTICIPATION_REASONS.map((r) => [r.value, r.label])
);

export default function DayTradingPage() {
  const { ipos, accounts, user, refreshData } = useFirebaseDataContext();
  const [selectedIpos, setSelectedIpos] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [batchLot, setBatchLot] = useState<number>(0);
  const [batchStatus, setBatchStatus] = useState<string>("Bekliyor");
  const [accountData, setAccountData] = useState<Record<string, Record<string, any>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [completedAccounts, setCompletedAccounts] = useState<string[]>([]);
  const [skippedAccounts, setSkippedAccounts] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSaveKeys, setPendingSaveKeys] = useState<string[]>([]);
  const [defaultLots, setDefaultLots] = useState<number>(100);
  const [defaultStatus, setDefaultStatus] = useState<string>("Talepte");
  const initializedRef = useRef(false);
  const loadedKeyRef = useRef("");
  const previousCellValueRef = useRef<Record<string, number>>({});

  const inferReasonByStatus = (status: string) => {
    if (status === "Nakit Yetersiz") return "cash_insufficient";
    if (status === "Giriş Yapılamıyor") return "login_failed";
    if (status === "Ulaşılamıyor") return "login_unreachable";
    if (status === "Katılmadı") return "manual_skip";
    return "";
  };

  const isNonParticipationStatus = (status: string) => {
    return status === "Katılmadı" || status === "Nakit Yetersiz" || status === "Giriş Yapılamıyor" || status === "Ulaşılamıyor";
  };

  const isCellResolved = (cell: any) => {
    const requestedLots = Number(cell?.requestedLots || 0);
    const status = String(cell?.status || "Bekliyor");
    const reasonCode = String(cell?.reasonCode || inferReasonByStatus(status) || "");
    if (requestedLots > 0) return true;
    if ((reasonCode || isNonParticipationStatus(status)) && Boolean(cell?.optOutConfirmed)) return true;
    return false;
  };

  const dayKey = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const draftStorageKey = useMemo(() => {
    if (!user?.uid) return "day-draft-anon";
    return `day-draft-${user.uid}-${dayKey}`;
  }, [user?.uid, dayKey]);

  const activeIpos = useMemo(() => {
    const now = Date.now();
    return (ipos || []).filter((ipo: any) => {
      if (ipo.dayEnabled === false) return false;
      const normalized = normalizeIpoStatus(String(ipo.status || ""));
      const demandEndTs = new Date(String(ipo.demandEndDate || "")).getTime();
      if (Number.isFinite(demandEndTs) && demandEndTs > 0 && demandEndTs <= now) return false;

      if (normalized === "basvuru_acik" || normalized === "talep_toplaniyor") return true;

      return false;
    }).sort((a: any, b: any) => {
      const dateA = new Date(a.demandEndDate || 0).getTime();
      const dateB = new Date(b.demandEndDate || 0).getTime();
      return dateA - dateB;
    });
  }, [ipos]);

  const visibleAccounts = useMemo(() => {
    return (accounts || []).filter((a: any) => a.isActive !== false);
  }, [accounts]);

  const sortedAccounts = useMemo(() => {
    const done = new Set(completedAccounts);
    const skipped = new Set(skippedAccounts);
    return [...visibleAccounts].sort((a: any, b: any) => {
      const rank = (id: string) => {
        if (done.has(id)) return 2;
        if (skipped.has(id)) return 1;
        return 0;
      };
      const aRank = rank(a.id);
      const bRank = rank(b.id);
      if (aRank !== bRank) return aRank - bRank;
      return String(a.ownerName || "").localeCompare(String(b.ownerName || ""), "tr");
    });
  }, [visibleAccounts, completedAccounts, skippedAccounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateOnline = () => setIsOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLots = Number(window.localStorage.getItem("defaultLots") || "100");
    const savedStatus = window.localStorage.getItem("defaultStatus") || "Talepte";
    const allowedStatuses = new Set(["Bekliyor", "Talepte", "Katılmadı", "Nakit Yetersiz", "Giriş Yapılamıyor", "Ulaşılamıyor"]);
    const safeLots = Number.isFinite(savedLots) && savedLots > 0 ? savedLots : 100;
    const safeStatus = allowedStatuses.has(savedStatus) ? savedStatus : "Talepte";
    setDefaultLots(safeLots);
    setDefaultStatus(safeStatus);
    setBatchLot(safeLots);
    setBatchStatus(safeStatus);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.selectedIpos)) setSelectedIpos(parsed.selectedIpos);
      if (Array.isArray(parsed.selectedAccounts)) setSelectedAccounts(parsed.selectedAccounts);
      if (parsed.accountData && typeof parsed.accountData === "object") setAccountData(parsed.accountData);
      if (Array.isArray(parsed.completedAccounts)) setCompletedAccounts(parsed.completedAccounts);
      if (Array.isArray(parsed.skippedAccounts)) setSkippedAccounts(parsed.skippedAccounts);
      if (Array.isArray(parsed.pendingSaveKeys)) setPendingSaveKeys(parsed.pendingSaveKeys);
    } catch {
      // ignore broken draft
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      selectedIpos,
      selectedAccounts,
      accountData,
      completedAccounts,
      skippedAccounts,
      pendingSaveKeys,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [draftStorageKey, selectedIpos, selectedAccounts, accountData, completedAccounts, skippedAccounts, pendingSaveKeys]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!activeIpos.length && !visibleAccounts.length) return;

    setSelectedIpos(activeIpos.map((i: any) => i.id));
    setSelectedAccounts((prev) => {
      if (prev.length) return prev;
      const first = visibleAccounts[0]?.id;
      return first ? [first] : [];
    });
    initializedRef.current = true;
  }, [activeIpos, visibleAccounts]);

  useEffect(() => {
    setSelectedIpos(activeIpos.map((i: any) => i.id));
  }, [activeIpos]);

  useEffect(() => {
    const loadExisting = async () => {
      if (!user || !visibleAccounts.length || !activeIpos.length) return;

      const key = `${user.uid}|${visibleAccounts.map((a: any) => a.id).join(",")}|${activeIpos.map((i: any) => i.id).join(",")}`;
      if (loadedKeyRef.current === key) return;

      loadedKeyRef.current = key;
      setIsLoadingExisting(true);
      try {
        const accountIds = visibleAccounts.map((a: any) => a.id);
        const entries = await Promise.all(
          activeIpos.map(async (ipo: any) => {
            const rows = await getParticipationsForIPO(user.uid, accountIds, ipo.id, ipo.ticker);
            return { ipoId: ipo.id, rows };
          })
        );

        setAccountData((prev) => {
          const next = { ...prev } as Record<string, Record<string, any>>;
          for (const item of entries) {
            for (const row of item.rows as any[]) {
              if (!next[row.accountId]) next[row.accountId] = {};
                next[row.accountId][item.ipoId] = {
                  ...(next[row.accountId][item.ipoId] || {}),
                  requestedLots: Number(row.requestedLots || 0),
                  allottedLots: Number(row.allottedLots || 0),
                  status: row.status || "Bekliyor",
                  purchaseType: row.purchaseType || "ipo",
                  notes: row.notes || "",
                  reasonCode: row.reasonCode || "",
                  reasonNote: row.reasonNote || "",
                  optOutConfirmed: Boolean(row.optOutConfirmed || false),
                  originalRequestedLots: Number(row.requestedLots || 0),
                  originalAllottedLots: Number(row.allottedLots || 0),
                };
            }
          }
          return next;
        });
      } finally {
        setIsLoadingExisting(false);
      }
    };

    loadExisting();
  }, [user, activeIpos, visibleAccounts]);

  const saveSingleCell = async (accountId: string, ipoId: string) => {
    if (!user) return;
    const account = visibleAccounts.find((a: any) => a.id === accountId);
    const ipo = activeIpos.find((i: any) => i.id === ipoId);
    if (!account || !ipo) return;

    if (!isOnline) {
      const key = `${accountId}|${ipoId}`;
      setPendingSaveKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      return;
    }

    const data = accountData[accountId]?.[ipoId] || {};
    const inferredReason = data.reasonCode || inferReasonByStatus(data.status || "");
    await processBatchOperation(
      user.uid,
      ipoId,
      Number(ipo.price || 0),
      [{
        id: accountId,
        requestedLots: Number(data.requestedLots || 0),
        allottedLots: Number(data.allottedLots || 0),
        status: data.status || (Number(data.requestedLots || 0) > 0 ? "Talepte" : "Bekliyor"),
        purchaseType: data.purchaseType || "ipo",
        notes: data.notes || "",
        reasonCode: inferredReason,
        reasonNote: data.reasonNote || "",
        optOutConfirmed: Boolean(data.optOutConfirmed || false),
        cashBalance: Number(account.cashBalance || 0),
        originalRequestedLots: Number(data.originalRequestedLots || 0),
        originalAllottedLots: Number(data.originalAllottedLots || 0),
      }],
      "talep"
    );

    setAccountData((prev) => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [ipoId]: {
          ...prev[accountId]?.[ipoId],
          originalRequestedLots: Number(data.requestedLots || 0),
          originalAllottedLots: Number(data.allottedLots || 0),
        },
      },
    }));
  };

  useEffect(() => {
    const flushPending = async () => {
      if (!isOnline || !pendingSaveKeys.length) return;
      const keys = [...new Set(pendingSaveKeys)];
      for (const key of keys) {
        const [accountId, ipoId] = key.split("|");
        try {
          await saveSingleCell(accountId, ipoId);
          setPendingSaveKeys((prev) => prev.filter((k) => k !== key));
        } catch {
          // keep in queue
        }
      }
    };
    flushPending();
  }, [isOnline, pendingSaveKeys]);

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
    );
    setSkippedAccounts((prev) => prev.filter((id) => id !== accountId));
  };

  const toggleAllAccounts = () => {
    if (!visibleAccounts.length) return;
    if (selectedAccounts.length === visibleAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(visibleAccounts.map((a: any) => a.id));
    }
  };

  const markOptOutWithConfirmation = (accountId: string, ipoId: string, partial: { status?: string; reasonCode?: string }) => {
    const current = accountData[accountId]?.[ipoId] || {};
    const requestedLots = Number(current.requestedLots || 0);
    if (requestedLots > 0) {
      setAccountData((prev) => ({
        ...prev,
        [accountId]: {
          ...prev[accountId],
          [ipoId]: {
            ...prev[accountId]?.[ipoId],
            ...partial,
            optOutConfirmed: false,
          },
        },
      }));
      return;
    }

    const nextStatus = partial.status ?? String(current.status || "Bekliyor");
    const nextReason = partial.reasonCode ?? String(current.reasonCode || inferReasonByStatus(nextStatus) || "");
    const ipo = activeIpos.find((i: any) => i.id === ipoId);
    const account = visibleAccounts.find((a: any) => a.id === accountId);
    const readableReason = REASON_LABEL[nextReason] || nextStatus || "Mazeret";
    const confirmed = window.confirm(
      `Bu hesaptan ${ipo?.ticker || "arz"} icin katilim yapmayacagini onayliyor musun?\nSebep: ${readableReason}\n\nBu isaretleme kirmizi olarak kaydedilecektir.`
    );

    if (!confirmed) return;

    setAccountData((prev) => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [ipoId]: {
          ...prev[accountId]?.[ipoId],
          ...partial,
          reasonCode: nextReason,
          optOutConfirmed: true,
          reasonNote: prev[accountId]?.[ipoId]?.reasonNote || (account ? `${account.ownerName || account.name} icin onayli katilmama` : ""),
        },
      },
    }));
  };

  const validateLotAndMaybeConfirm = (accountId: string, ipoId: string) => {
    const ipo = activeIpos.find((i: any) => i.id === ipoId);
    if (!ipo) return true;
    const recommendedLot = Number(ipo.recommendedLot || 0);
    if (recommendedLot <= 0) return true;

    const current = Number(accountData[accountId]?.[ipoId]?.requestedLots || 0);
    if (current <= 0) return true;

    let message = "";
    if (current < recommendedLot) {
      message = `Tavsiye edilen lot (${recommendedLot}) altinda talep girdiniz (${current}). Devam etmek istiyor musunuz?`;
    } else if (current > Math.round(recommendedLot * 1.5)) {
      message = `Tavsiye edilen lotu %50'den fazla astiniz. Oneri: ${recommendedLot}, Girilen: ${current}. Devam edilsin mi?`;
    }

    if (!message) return true;
    const ok = window.confirm(message);
    if (ok) return true;

    const key = `${accountId}|${ipoId}`;
    const prev = Number(previousCellValueRef.current[key] || 0);
    setAccountData((data) => ({
      ...data,
      [accountId]: {
        ...data[accountId],
        [ipoId]: {
          ...data[accountId]?.[ipoId],
          requestedLots: prev,
          status: prev > 0 ? "Talepte" : (data[accountId]?.[ipoId]?.status || "Bekliyor"),
          reasonCode: prev > 0 ? "" : (data[accountId]?.[ipoId]?.reasonCode || ""),
          optOutConfirmed: prev > 0 ? false : Boolean(data[accountId]?.[ipoId]?.optOutConfirmed || false),
        },
      },
    }));
    return false;
  };

  const applyBatchLot = () => {
    if (batchLot <= 0) return;
    
    setAccountData(prev => {
      const newData = { ...prev };
      selectedAccounts.forEach(accId => {
        if (!newData[accId]) newData[accId] = {};
        selectedIpos.forEach(ipoId => {
          newData[accId][ipoId] = {
            ...newData[accId][ipoId],
            requestedLots: batchLot,
            status: batchStatus,
            purchaseType: 'ipo',
            reasonCode: batchLot > 0 ? "" : inferReasonByStatus(batchStatus),
            reasonNote: batchLot > 0 ? "" : (newData[accId][ipoId]?.reasonNote || ""),
          };
        });
      });
      return newData;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    if (selectedAccounts.length === 0 || selectedIpos.length === 0) {
      alert("Lütfen en az bir hesap ve bir halka arz seçin!");
      return;
    }

    setIsSaving(true);
    try {
      for (const ipoId of selectedIpos) {
        const ipo = activeIpos.find((i: any) => i.id === ipoId);
        if (!ipo) continue;

        const updatedAccounts = selectedAccounts
          .map((accountId) => {
            const account = visibleAccounts.find((a: any) => a.id === accountId);
            if (!account) return null;
            const data = accountData[accountId]?.[ipoId] || {};
            const inferredReason = data.reasonCode || inferReasonByStatus(data.status || "");
            return {
              id: accountId,
              requestedLots: Number(data.requestedLots || 0),
              allottedLots: Number(data.allottedLots || 0),
              status: data.status || "Bekliyor",
              purchaseType: data.purchaseType || "ipo",
              notes: data.notes || "",
              reasonCode: inferredReason,
              reasonNote: data.reasonNote || "",
              optOutConfirmed: Boolean(data.optOutConfirmed || false),
              cashBalance: Number(account.cashBalance || 0),
              originalRequestedLots: Number(data.originalRequestedLots || 0),
              originalAllottedLots: Number(data.originalAllottedLots || 0),
            };
          })
          .filter(Boolean) as any[];

        await processBatchOperation(user.uid, ipoId, Number(ipo.price || 0), updatedAccounts, "talep");
      }

      await refreshData();
      alert("Kaydedildi!");
    } catch (e) {
      console.error(e);
      alert("Kaydetme sırasında hata oluştu!");
    } finally {
      setIsSaving(false);
    }
  };

  const completeAndNext = async (accountId: string) => {
    try {
      const unresolved = activeIpos.filter((ipo: any) => {
        const cell = accountData[accountId]?.[ipo.id] || {};
        return !isCellResolved(cell);
      });

      if (unresolved.length > 0) {
        const preview = unresolved.slice(0, 4).map((i: any) => i.ticker || i.companyName || i.id).join(", ");
        alert(`Bu hesap tamamlanamaz. Bekleyen arzlar var: ${preview}${unresolved.length > 4 ? " ..." : ""}`);
        return;
      }

      for (const ipoId of activeIpos.map((i: any) => i.id)) {
        await saveSingleCell(accountId, ipoId);
      }

      setCompletedAccounts((prev) => (prev.includes(accountId) ? prev : [...prev, accountId]));
      setSkippedAccounts((prev) => prev.filter((id) => id !== accountId));
      setSelectedAccounts((prev) => prev.filter((id) => id !== accountId));

      const done = new Set([...completedAccounts, accountId]);
      const next = sortedAccounts.find((a: any) => !done.has(a.id));
      if (next) {
        setSelectedAccounts((prev) => (prev.includes(next.id) ? prev : [...prev, next.id]));
        setTimeout(() => {
          const el = document.getElementById(`account-${next.id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
      }
    } catch (e) {
      console.error(e);
      alert("Hesap tamamlanirken kaydetme hatasi olustu.");
    }
  };

  const skipAndNext = (accountId: string) => {
    setSkippedAccounts((prev) => (prev.includes(accountId) ? prev : [...prev, accountId]));
    setSelectedAccounts((prev) => prev.filter((id) => id !== accountId));

    const done = new Set(completedAccounts);
    const skipped = new Set([...skippedAccounts, accountId]);
    const next = sortedAccounts.find((a: any) => a.id !== accountId && !done.has(a.id) && !skipped.has(a.id))
      || sortedAccounts.find((a: any) => a.id !== accountId && !done.has(a.id));
    if (next) {
      setSelectedAccounts((prev) => (prev.includes(next.id) ? prev : [...prev, next.id]));
      setTimeout(() => {
        const el = document.getElementById(`account-${next.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  };

  const jumpToAccount = (accountId: string) => {
    setSelectedAccounts((prev) => (prev.includes(accountId) ? prev : [...prev, accountId]));
    setSkippedAccounts((prev) => prev.filter((id) => id !== accountId));
    setTimeout(() => {
      const el = document.getElementById(`account-${accountId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const jumpToMissingCell = (accountId: string, ipoId: string) => {
    jumpToAccount(accountId);
    setTimeout(() => {
      const cell = document.getElementById(`cell-${accountId}-${ipoId}`);
      if (cell) cell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 120);
  };

  const summary = useMemo(() => {
    let totalLots = 0;
    let totalCost = 0;

    selectedAccounts.forEach(accId => {
      selectedIpos.forEach(ipoId => {
        const data = accountData[accId]?.[ipoId];
        const ipo = activeIpos.find((i: any) => i.id === ipoId);
        
        if (data?.requestedLots > 0) {
          totalLots += data.requestedLots;
          totalCost += data.requestedLots * (ipo?.price || 0);
        }
      });
    });

    return { totalLots, totalCost };
  }, [selectedAccounts, selectedIpos, accountData, activeIpos]);

  const accountProgressById = useMemo(() => {
    const result: Record<string, { pending: number; optedOut: number; participated: number }> = {};
    for (const account of visibleAccounts) {
      let pending = 0;
      let optedOut = 0;
      let participated = 0;
      for (const ipo of activeIpos) {
        const cell = accountData[account.id]?.[ipo.id] || {};
        const requestedLots = Number(cell.requestedLots || 0);
        if (requestedLots > 0) {
          participated++;
          continue;
        }
        if (isCellResolved(cell)) {
          optedOut++;
        } else {
          pending++;
        }
      }
      result[account.id] = { pending, optedOut, participated };
    }
    return result;
  }, [visibleAccounts, activeIpos, accountData, isCellResolved]);

  const ipoStats = useMemo(() => {
    const stats: Record<string, { participatedAccounts: number; totalRequested: number; totalAllotted: number; totalInvestment: number }> = {};
    for (const ipo of activeIpos) {
      let participatedAccounts = 0;
      let totalRequested = 0;
      let totalAllotted = 0;
      let totalInvestment = 0;
      
      for (const account of visibleAccounts) {
        const cell = accountData[account.id]?.[ipo.id] || {};
        const requested = Number(cell.requestedLots || 0);
        const allotted = Number(cell.allottedLots || 0);
        if (requested > 0) participatedAccounts++;
        totalRequested += requested;
        totalAllotted += allotted;
        totalInvestment += requested * Number(ipo.price || 0);
      }
      stats[ipo.id] = { participatedAccounts, totalRequested, totalAllotted, totalInvestment };
    }
    return stats;
  }, [visibleAccounts, activeIpos, accountData]);

  const incompleteAccounts = useMemo(() => {
    return visibleAccounts
      .map((a: any) => ({ account: a, progress: accountProgressById[a.id] || { pending: 0, optedOut: 0, participated: 0 } }))
      .filter((x: any) => x.progress.pending > 0)
      .sort((a: any, b: any) => b.progress.pending - a.progress.pending);
  }, [visibleAccounts, accountProgressById]);

  const missingMatrix = useMemo(() => {
    return incompleteAccounts.map((x: any) => {
      const missingIpos = activeIpos.filter((ipo: any) => {
        const cell = accountData[x.account.id]?.[ipo.id] || {};
        return !isCellResolved(cell);
      });
      return {
        account: x.account,
        missingIpos,
      };
    });
  }, [incompleteAccounts, activeIpos, accountData, isCellResolved]);

  const dailyReport = useMemo(() => {
    const rows: Array<{
      accountId: string;
      accountName: string;
      bankName: string;
      ipoId: string;
      ticker: string;
      requestedLots: number;
      amount: number;
      status: string;
      reasonCode: string;
      reasonNote: string;
      completed: boolean;
      resolved: boolean;
    }> = [];

    for (const account of visibleAccounts) {
      for (const ipo of activeIpos) {
        const cell = accountData[account.id]?.[ipo.id] || {};
        const requestedLots = Number(cell.requestedLots || 0);
        const amount = requestedLots * Number(ipo.price || 0);
        const status = String(cell.status || (requestedLots > 0 ? "Talepte" : "Bekliyor"));
        const reasonCode = String(cell.reasonCode || inferReasonByStatus(status) || "");
        const reasonNote = String(cell.reasonNote || "");
        const resolved = isCellResolved(cell);
        rows.push({
          accountId: account.id,
          accountName: String(account.ownerName || account.name || "-"),
          bankName: String(account.bankName || "-"),
          ipoId: ipo.id,
          ticker: String(ipo.ticker || "-").toUpperCase(),
          requestedLots,
          amount,
          status,
          reasonCode,
          reasonNote,
          completed: completedAccounts.includes(account.id),
          resolved,
        });
      }
    }

    const participated = rows.filter((r) => r.requestedLots > 0).length;
    const skipped = rows.filter((r) => r.requestedLots <= 0 && r.resolved).length;
    const pending = rows.length - participated - skipped;
    const notCompletedAccounts = visibleAccounts.filter((a: any) => !completedAccounts.includes(a.id));

    return {
      rows,
      totalCells: rows.length,
      participated,
      skipped,
      pending,
      notCompletedAccounts,
    };
  }, [visibleAccounts, activeIpos, accountData, completedAccounts, isCellResolved]);

  const downloadDailyCsv = () => {
    if (typeof window === "undefined") return;
    const headers = [
      "Tarih",
      "Hesap Sahibi",
      "Banka",
      "Arz",
      "Talep Lot",
      "Tutar",
      "Durum",
      "Katilamama Sebebi",
      "Sebep Notu",
      "Hesap Tamamlandi",
    ];
    const lines = [headers.join(";")];
    dailyReport.rows.forEach((r) => {
      lines.push([
        dayKey,
        r.accountName,
        r.bankName,
        r.ticker,
        String(r.requestedLots),
        String(Math.round(r.amount)),
        r.status,
        REASON_LABEL[r.reasonCode] || "",
        r.reasonNote.replace(/;/g, ","),
        r.completed ? "Evet" : "Hayir",
      ].join(";"));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halka-arz-gunluk-rapor-${dayKey}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">İşlem Günü</h1>
            <p className="text-xs text-zinc-500 font-bold">
              {activeIpos.length} aktif arz, {visibleAccounts.length} hesap
            </p>
            {isLoadingExisting && <p className="text-[10px] text-zinc-500">Mevcut talepler yukleniyor...</p>}
            {!isOnline && <p className="text-[10px] text-amber-400">Offline: Degisiklikler kuyruga aliniyor</p>}
          </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
            isSaving 
              ? "bg-zinc-800 text-zinc-500" 
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Toplam Lot</p>
          <p className="text-lg font-black">{summary.totalLots}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-400 uppercase font-bold">Tahmini Tutar</p>
          <p className="text-lg font-black text-emerald-400">₺{summary.totalCost.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black">GUNLUK KATILIM RAPORU</h2>
          <button
            onClick={downloadDailyCsv}
            className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" /> CSV Indir
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase font-bold">Hucre</div>
            <div className="text-sm font-black">{dailyReport.totalCells}</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-[10px] text-emerald-400 uppercase font-bold">Katilim</div>
            <div className="text-sm font-black text-emerald-400">{dailyReport.participated}</div>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="text-[10px] text-amber-400 uppercase font-bold">Katilmadi</div>
            <div className="text-sm font-black text-amber-400">{dailyReport.skipped}</div>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase font-bold">Bekleyen</div>
            <div className="text-sm font-black">{dailyReport.pending}</div>
          </div>
        </div>
        {dailyReport.notCompletedAccounts.length > 0 && (
          <p className="text-xs text-zinc-500">
            Tamamlanmayan hesaplar: {dailyReport.notCompletedAccounts.map((a: any) => a.ownerName || a.name).join(", ")}
          </p>
        )}
      </section>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-black">ARZ ISTASTISTIKLERI</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[400px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-2">Arz</th>
                <th className="py-2 px-2 text-right">Katilan Hesap</th>
                <th className="py-2 px-2 text-right">Toplam Talep (Lot)</th>
                <th className="py-2 px-2 text-right">Dagitim (Lot)</th>
                <th className="py-2 pl-2 text-right">Yatirim (TL)</th>
              </tr>
            </thead>
            <tbody>
              {activeIpos.map((ipo: any) => {
                const s = ipoStats[ipo.id] || { participatedAccounts: 0, totalRequested: 0, totalAllotted: 0, totalInvestment: 0 };
                return (
                  <tr key={ipo.id} className="border-b border-zinc-900">
                    <td className="py-2 pr-2 text-xs font-bold">{ipo.ticker}</td>
                    <td className="py-2 px-2 text-xs text-right text-emerald-400">{s.participatedAccounts}</td>
                    <td className="py-2 px-2 text-xs text-right text-amber-400">{s.totalRequested}</td>
                    <td className="py-2 px-2 text-xs text-right text-blue-400">{s.totalAllotted}</td>
                    <td className="py-2 pl-2 text-xs text-right font-bold">{s.totalInvestment.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-black">TAMAMLANMAYAN HESAPLAR</h2>
        {incompleteAccounts.length === 0 ? (
          <p className="text-xs text-emerald-400 font-bold">Tum hesaplarda aktif arzlar icin talep/mazeret girildi.</p>
        ) : (
          <div className="space-y-2">
            {incompleteAccounts.map((item: any) => (
              <div key={item.account.id} className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{item.account.ownerName || item.account.name}</p>
                  <p className="text-[11px] text-amber-300">Eksik arz: {item.progress.pending}</p>
                </div>
                <button
                  onClick={() => jumpToAccount(item.account.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Hesaba Git
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-3 overflow-x-auto">
        <h2 className="text-sm font-black">EKSIK ARZ-HESAP MATRISI</h2>
        {missingMatrix.length === 0 ? (
          <p className="text-xs text-zinc-500">Eksik hucre yok.</p>
        ) : (
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-2">Hesap</th>
                <th className="py-2 px-2">Eksik Arzlar</th>
                <th className="py-2 pl-2 text-right">Hizli Git</th>
              </tr>
            </thead>
            <tbody>
              {missingMatrix.map((row: any) => (
                <tr key={row.account.id} className="border-b border-zinc-900">
                  <td className="py-2 pr-2 text-xs font-bold">{row.account.ownerName || row.account.name}</td>
                  <td className="py-2 px-2 text-xs text-amber-300">
                    <div className="flex flex-wrap gap-1">
                      {row.missingIpos.map((i: any) => (
                        <button
                          key={i.id}
                          onClick={() => jumpToMissingCell(row.account.id, i.id)}
                          className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold"
                        >
                          {i.ticker || i.companyName}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      onClick={() => jumpToAccount(row.account.id)}
                      className="px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-400 text-[11px] font-bold"
                    >
                      Ac
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black">AKTİF ARZLAR</h2>
          <span className="text-[11px] text-zinc-500">Varsayilan olarak secili</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {activeIpos.map((ipo: any) => {
            const rec = Number(ipo.recommendedLot || 0);
            return (
              <span
                key={ipo.id}
                className="px-2 py-1 rounded-md text-[11px] font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              >
                {ipo.ticker} · ₺{Number(ipo.price || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                {rec > 0 ? ` · Oneri: ${rec}L` : ""}
              </span>
            );
          })}
          
          {activeIpos.length === 0 && (
            <p className="text-zinc-500 text-sm py-2">Aktif halka arz bulunmuyor</p>
          )}
        </div>
      </section>

      <section className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4">
        <h2 className="text-sm font-black mb-3">TOPLU İŞLEM</h2>
        
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Lot"
            value={batchLot || ""}
            onChange={(e) => setBatchLot(Number(e.target.value))}
            className="flex-1 min-w-[100px] bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
          />
          
          <select
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
          >
            <option>Bekliyor</option>
            <option>Talepte</option>
            <option>Katılmadı</option>
            <option>Nakit Yetersiz</option>
            <option>Giriş Yapılamıyor</option>
            <option>Ulaşılamıyor</option>
          </select>

          <button
            onClick={applyBatchLot}
            disabled={batchLot <= 0 || selectedAccounts.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold text-white transition-colors"
          >
            Uygula
          </button>
          <button
            onClick={() => {
              if (selectedIpos.length === 0 || selectedAccounts.length === 0) return;
              
              // Apply recommended lot for EACH selected IPO to ALL selected accounts
              setAccountData(prev => {
                const next = { ...prev };
                for (const accId of selectedAccounts) {
                  if (!next[accId]) next[accId] = {};
                  for (const ipoId of selectedIpos) {
                    const ipo = activeIpos.find((i: any) => i.id === ipoId);
                    const recLot = Number(ipo?.recommendedLot || 0);
                    if (recLot > 0) {
                      next[accId][ipoId] = {
                        ...(next[accId][ipoId] || {}),
                        requestedLots: recLot,
                        status: "Talepte",
                        reasonCode: "",
                        optOutConfirmed: false,
                      };
                    }
                  }
                }
                return next;
              });
            }}
            disabled={selectedIpos.length === 0 || selectedAccounts.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold text-white transition-colors"
          >
            Onerileri Uygula
          </button>
          <button
            onClick={() => {
              setBatchLot(defaultLots);
              setBatchStatus(defaultStatus);
            }}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold text-zinc-300 transition-colors"
          >
            Varsayilan
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black">HESAPLAR</h2>
          <button
            onClick={toggleAllAccounts}
            className="text-xs text-emerald-400 font-bold"
          >
             {selectedAccounts.length === visibleAccounts.length ? "Tümünü Kaldır" : "Tümünü Seç"}
          </button>
        </div>

        <div className="space-y-3">
          {sortedAccounts.map((account: any) => (
            (() => {
              const progress = accountProgressById[account.id] || { pending: 0, optedOut: 0, participated: 0 };
              const isCompleted = completedAccounts.includes(account.id);
              const isSkipped = skippedAccounts.includes(account.id);
              const hasRed = progress.optedOut > 0;
              const hasPending = progress.pending > 0;
              const cardStateClass = isCompleted
                ? "border-emerald-500/40 bg-emerald-500/5"
                : selectedAccounts.includes(account.id)
                ? "border-emerald-500/40"
                : hasRed
                ? "border-rose-500/40 bg-rose-500/5"
                : hasPending || isSkipped
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-zinc-800";

              return (
            <div
              key={account.id}
              id={`account-${account.id}`}
              className={`bg-zinc-900/30 border rounded-2xl overflow-hidden transition-all ${cardStateClass}`}
            >
              <div 
                className="p-3 flex items-center justify-between cursor-pointer"
                onClick={() => toggleAccount(account.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedAccounts.includes(account.id)
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-zinc-600"
                  }`}>
                    {selectedAccounts.includes(account.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{account.ownerName || account.name}</p>
                    <p className="text-xs text-zinc-500">{account.bankName}</p>
                    {isCompleted && (
                      <p className="text-[10px] text-emerald-400 font-bold">Bugun tamamlandi</p>
                    )}
                    {progress.pending > 0 && <p className="text-[10px] text-amber-400 font-bold">Bekleyen arz: {progress.pending}</p>}
                    {progress.optedOut > 0 && <p className="text-[10px] text-rose-400 font-bold">Onayli katilmama: {progress.optedOut}</p>}
                    {isSkipped && <p className="text-[10px] text-amber-300 font-bold">Atlandi, sonra donulecek</p>}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase">Bakiye</p>
                    <p className="text-xs font-bold text-emerald-400">{(account.cashBalance || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
                  </div>
                  
                  {(() => {
                    const loginUrl = (account.bankId && getBankLoginUrl(account.bankId)) || getBankLoginUrl(account.bankName || "");
                    return !!loginUrl;
                  })() && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = (account.bankId && getBankLoginUrl(account.bankId)) || getBankLoginUrl(account.bankName || "");
                        if (url) window.open(url, '_blank');
                      }}
                      className="p-1.5 bg-green-500/10 text-green-400 rounded-lg"
                      title="Banka/Giriş"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(account.accountNumber || "");
                    }}
                    className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg"
                    title="Hesap no"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(account.password || "");
                    }}
                    className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"
                    title="Şifre"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {selectedAccounts.includes(account.id) && (
                <div className="border-t border-zinc-800 p-3 bg-zinc-950/30">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {selectedIpos.map(ipoId => {
                      const ipo = activeIpos.find((i: any) => i.id === ipoId);
                      const data = accountData[account.id]?.[ipoId];
                      
                      return (
                        <div
                          key={ipoId}
                          id={`cell-${account.id}-${ipoId}`}
                          className={`p-2 rounded-lg border transition-all ${
                            Number(data?.requestedLots || 0) > 0
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : data?.optOutConfirmed
                              ? "bg-rose-500/10 border-rose-500/40"
                              : "bg-amber-500/10 border-amber-500/30"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">{ipo?.ticker}</span>
                            <span className="text-[10px] text-zinc-500">₺{Number(ipo?.price || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          
                          <input
                            type="number"
                            placeholder="Lot"
                            value={data?.requestedLots || ""}
                            onFocus={() => {
                              const key = `${account.id}|${ipoId}`;
                              previousCellValueRef.current[key] = Number(data?.requestedLots || 0);
                            }}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAccountData(prev => ({
                                ...prev,
                                [account.id]: {
                                  ...prev[account.id],
                                  [ipoId]: {
                                    ...prev[account.id]?.[ipoId],
                                    requestedLots: val,
                                    status: val > 0 ? "Talepte" : "Bekliyor",
                                    reasonCode: val > 0 ? "" : (prev[account.id]?.[ipoId]?.reasonCode || ""),
                                    optOutConfirmed: val > 0 ? false : Boolean(prev[account.id]?.[ipoId]?.optOutConfirmed || false),
                                  }
                                }
                              }));
                            }}
                            onBlur={() => {
                              const accepted = validateLotAndMaybeConfirm(account.id, ipoId);
                              if (!accepted) return;
                              saveSingleCell(account.id, ipoId).catch((e) => console.error(e));
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-bold outline-none focus:border-emerald-500"
                          />
                          {Number(ipo?.recommendedLot || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const rec = Number(ipo?.recommendedLot || 0);
                                setAccountData((prev) => ({
                                  ...prev,
                                  [account.id]: {
                                    ...prev[account.id],
                                    [ipoId]: {
                                      ...prev[account.id]?.[ipoId],
                                      requestedLots: rec,
                                      status: "Talepte",
                                      reasonCode: "",
                                      optOutConfirmed: false,
                                    },
                                  },
                                }));
                              }}
                              className="mt-1 px-2 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-[10px] font-bold text-blue-300"
                            >
                              Oneri {Number(ipo?.recommendedLot || 0)}L
                            </button>
                          )}
                          {data?.requestedLots > 0 && (
                            <div className="text-[10px] text-emerald-400 font-bold mt-1">
                              = ₺{(data.requestedLots * (ipo?.price || 0)).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                            </div>
                          )}
                          <select
                            value={data?.status || "Bekliyor"}
                            onChange={(e) => {
                              const nextStatus = e.target.value;
                              const requestedLots = Number(data?.requestedLots || 0);
                              if (requestedLots <= 0 && isNonParticipationStatus(nextStatus)) {
                                markOptOutWithConfirmation(account.id, ipoId, { status: nextStatus, reasonCode: inferReasonByStatus(nextStatus) });
                                return;
                              }

                              setAccountData((prev) => ({
                                ...prev,
                                [account.id]: {
                                  ...prev[account.id],
                                  [ipoId]: {
                                    ...prev[account.id]?.[ipoId],
                                    status: nextStatus,
                                    reasonCode: requestedLots > 0 ? "" : (prev[account.id]?.[ipoId]?.reasonCode || ""),
                                    optOutConfirmed: false,
                                  },
                                },
                              }));
                            }}
                            className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-bold outline-none focus:border-emerald-500"
                          >
                            <option>Bekliyor</option>
                            <option>Talepte</option>
                            <option>Katılmadı</option>
                            <option>Nakit Yetersiz</option>
                            <option>Giriş Yapılamıyor</option>
                            <option>Ulaşılamıyor</option>
                          </select>
                          {Number(data?.requestedLots || 0) <= 0 && (
                            <>
                              <select
                                value={data?.reasonCode || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (!value) {
                                    setAccountData((prev) => ({
                                      ...prev,
                                      [account.id]: {
                                        ...prev[account.id],
                                        [ipoId]: {
                                          ...prev[account.id]?.[ipoId],
                                          reasonCode: "",
                                          optOutConfirmed: false,
                                        },
                                      },
                                    }));
                                    return;
                                  }
                                  markOptOutWithConfirmation(account.id, ipoId, { reasonCode: value });
                                }}
                                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-bold outline-none focus:border-amber-500"
                              >
                                {NON_PARTICIPATION_REASONS.map((r) => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={data?.reasonNote || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setAccountData((prev) => ({
                                    ...prev,
                                    [account.id]: {
                                      ...prev[account.id],
                                      [ipoId]: {
                                        ...prev[account.id]?.[ipoId],
                                        reasonNote: value,
                                      },
                                    },
                                  }));
                                }}
                                placeholder="Kisa not"
                                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-bold outline-none focus:border-amber-500"
                              />
                              {data?.optOutConfirmed && (
                                <p className="mt-1 text-[10px] text-rose-300 font-bold">Katilmama onaylandi</p>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between text-xs">
                    <span className="text-zinc-500">Bu Hesap Toplam:</span>
                    <span className="font-bold text-emerald-400">
                      ₺{(() => {
                        let cost = 0;
                        selectedIpos.forEach(ipoId => {
                          const d = accountData[account.id]?.[ipoId];
                          const ipo = activeIpos.find((i: any) => i.id === ipoId);
                          if (d?.requestedLots > 0) {
                            cost += d.requestedLots * (ipo?.price || 0);
                          }
                        });
                        return cost.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
                      })()}
                    </span>
                  </div>
                  <button
                    onClick={() => completeAndNext(account.id)}
                    disabled={progress.pending > 0}
                    className="mt-3 w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-white text-sm font-bold"
                  >
                    Hesabi Bitir ve Siradaki Hesaba Gec
                  </button>
                  <button
                    onClick={() => skipAndNext(account.id)}
                    className="mt-2 w-full h-10 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-bold border border-amber-500/40"
                  >
                    Bu Hesabi Atla (Sonra Don)
                  </button>
                </div>
              )}
            </div>
              );
            })()
          ))}
          {visibleAccounts.length === 0 && (
            <div className="text-zinc-500 text-sm py-3 text-center border border-zinc-800 rounded-xl bg-zinc-900/20">
              Aktif hesap bulunmuyor. Ayarlar &gt; Hesap Yonetimi sayfasindan hesaplari aktif edin.
            </div>
          )}
        </div>
      </section>

      <div className="h-10" />
    </div>
  );
}
