"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useFirebaseData } from "@/hooks/useFirebaseData";

type FirebaseDataState = ReturnType<typeof useFirebaseData>;

const Ctx = createContext<FirebaseDataState | null>(null);

export function FirebaseDataProvider({ children }: { children: React.ReactNode }) {
  const state = useFirebaseData();
  const value = useMemo(() => state, [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFirebaseDataContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFirebaseDataContext must be used within FirebaseDataProvider");
  return v;
}
