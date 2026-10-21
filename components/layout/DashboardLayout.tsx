import type { ReactNode } from "react";
import { getDashboardContext } from "../../features/companies/server-context";
import { ActiveCompanyProvider } from "../../features/companies/ActiveCompanyContext";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import styles from "./dashboard.module.scss";

export async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await getDashboardContext();
  // Page boundaries also check access. Denied/unavailable pages keep their existing safe state.
  if (context.kind !== "authenticated" || (!context.activeCompany && context.companies.length > 0)) return children;
  return <ActiveCompanyProvider companies={context.companies} activeCompany={context.activeCompany}>
    <div className={styles.shell}>
      <a href="#dashboard-content" className={styles.skipLink}>Pular para o conteúdo</a>
      <aside className={styles.desktopSidebar} aria-label="Barra lateral"><Sidebar user={context.user} /></aside>
      <div className={styles.workspace}><DashboardHeader user={context.user} /><main id="dashboard-content" tabIndex={-1} className={styles.content}>{children}</main></div>
    </div>
  </ActiveCompanyProvider>;
}
