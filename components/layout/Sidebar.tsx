import Link from "next/link";
import Image from "next/image";
import { SidebarNavigation } from "./SidebarNavigation";
import { UserMenu } from "./UserMenu";
import type { DisplayUser } from "../../lib/auth/display-user";
import styles from "./dashboard.module.scss";

export function Sidebar({ onNavigate, user = null }: { onNavigate?: () => void; user?: DisplayUser | null }) {
  return <div className={styles.sidebarContents}>
    <Link href="/dashboard" className={styles.brand} onClick={onNavigate} aria-label="Cartly — início"><Image src="/logo.svg" width={36} height={32} alt="" unoptimized />cartly<span aria-hidden="true">.</span></Link>
    <p className={styles.sidebarCaption}>Painel administrativo</p>
    <SidebarNavigation onNavigate={onNavigate} />
    <div className={styles.sidebarAccount}><UserMenu user={user} /></div>
    <p className={styles.sidebarFootnote}>Seu negócio, em um só lugar.</p>
  </div>;
}
