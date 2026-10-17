"use client";

import { useHydratedPathname } from "./useHydratedPathname";
import { CompanySelector } from "../../features/companies/CompanySelector";
import { MobileNavigation } from "./MobileNavigation";
import type { DisplayUser } from "../../lib/auth/display-user";
import styles from "./dashboard.module.scss";

export function DashboardHeader({ user }: { user: DisplayUser | null }) {
  const pathname = useHydratedPathname();
  return <header className={styles.header}>
    <div className={styles.heading}><MobileNavigation user={user} /><div><p className={styles.eyebrow}>Seu espaço de gestão</p><h1>{pathname === null ? "Painel administrativo" : pathname === "/dashboard/products" ? "Produtos" : pathname === "/dashboard/categories" ? "Categorias" : pathname === "/dashboard/onboarding" ? "Nova empresa" : "Dashboard"}</h1></div></div>
    <div className={styles.headerActions}><CompanySelector compact /></div>
  </header>;
}
