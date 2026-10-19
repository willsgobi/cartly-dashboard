"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Scoped to the recovery route group: discarded on leaving it; never persisted.
const RecoveryContext = createContext<{ email: string; setEmail: (email: string) => void } | null>(null);

export function RecoveryProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState("");
  return <RecoveryContext.Provider value={{ email, setEmail }}>{children}</RecoveryContext.Provider>;
}

export function useRecoveryEmail() {
  const context = useContext(RecoveryContext);
  if (!context) throw new Error("RecoveryProvider is required");
  return context;
}
