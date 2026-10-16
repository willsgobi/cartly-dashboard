"use client";

import { createContext, Fragment, useContext, type ReactNode } from "react";
import type { Company } from "../../lib/api/companies";

type ActiveCompanyState = { companies: Company[]; activeCompany: Company | null };
const ActiveCompanyContext = createContext<ActiveCompanyState | null>(null);

export function ActiveCompanyProvider({ companies, activeCompany, children }: ActiveCompanyState & { children: ReactNode }) {
  return (
    <ActiveCompanyContext value={{ companies, activeCompany }}>
      <Fragment key={activeCompany?.id ?? "unselected"}>{children}</Fragment>
    </ActiveCompanyContext>
  );
}

export function useActiveCompany(): ActiveCompanyState {
  const context = useContext(ActiveCompanyContext);
  if (!context) throw new Error("useActiveCompany requires ActiveCompanyProvider");
  return context;
}
