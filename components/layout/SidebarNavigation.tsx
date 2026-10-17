"use client";

import Link from "next/link";
import { useHydratedPathname } from "./useHydratedPathname";
import { NavigationIcon, type IconName } from "./NavigationIcon";
import styles from "./dashboard.module.scss";

const items: { label: string; icon: IconName; href?: string }[] = [
  { label: "Dashboard", icon: "dashboard", href: "/dashboard" },
  { label: "Pedidos", icon: "orders" }, { label: "Produtos", icon: "products", href: "/dashboard/products" },
  { label: "Categorias", icon: "categories", href: "/dashboard/categories" }, { label: "Clientes", icon: "customers" },
  { label: "Usuários", icon: "users" }, { label: "Relatórios", icon: "reports" },
  { label: "Configurações", icon: "settings" },
];

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useHydratedPathname();
  return <nav aria-label="Navegação principal"><ul className={styles.navigation}>
    {items.map((item) => <li key={item.label}>
      {item.href ? <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={onNavigate} className={styles.navLink}><NavigationIcon name={item.icon} /><span>{item.label}</span></Link>
        : <span aria-disabled="true" className={styles.unavailable}><NavigationIcon name={item.icon} /><span>{item.label}</span><small>Em breve</small></span>}
    </li>)}
  </ul></nav>;
}
