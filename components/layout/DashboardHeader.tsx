"use client";

import { usePathname } from "next/navigation";
import { CompanySelector } from "../../features/companies/CompanySelector";
import { MobileNavigation } from "./MobileNavigation";
import type { DisplayUser } from "../../lib/auth/display-user";
import styles from "./dashboard.module.scss";

export function DashboardHeader({ user }: { user: DisplayUser | null }) {
  const pathname = usePathname();
  return <header className={styles.header}>
    <div className={styles.heading}><MobileNavigation user={user} /><div><p className={styles.eyebrow}>Seu espaço de gestão</p><h1>{pathname === "/dashboard/onboarding" ? "Nova empresa" : "Dashboard"}</h1></div></div>
    <div className={styles.headerActions}><CompanySelector compact /></div>
  </header>;
}
