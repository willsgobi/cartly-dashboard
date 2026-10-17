import Link from "next/link";
import Image from "next/image";
import { SidebarNavigation } from "./SidebarNavigation";
import styles from "./dashboard.module.scss";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <div className={styles.sidebarContents}>
    <Link href="/dashboard" className={styles.brand} onClick={onNavigate} aria-label="Cartly — início"><Image src="/logo.svg" width={36} height={32} alt="" unoptimized />cartly<span aria-hidden="true">.</span></Link>
    <p className={styles.sidebarCaption}>Painel administrativo</p>
    <SidebarNavigation onNavigate={onNavigate} />
    <p className={styles.sidebarFootnote}>Seu negócio, em um só lugar.</p>
  </div>;
}
