"use client";

import { Button } from "../ui/Button";
import type { DisplayUser } from "../../lib/auth/display-user";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./dashboard.module.scss";

export function UserMenu({ user }: { user: DisplayUser | null }) {
  return <details className={styles.userMenu} data-user-menu onKeyDown={(event) => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}>
    <summary aria-label="Minha conta"><NavigationIcon name="customers" /><span>Minha conta</span><span className={styles.accountChevron}><NavigationIcon name="chevronDown" /></span></summary>
    <div className={styles.userPopover}><strong>{user?.name || "Conta conectada"}</strong>{user && <p>{user.email}</p>}<form action="/api/auth/logout" method="post"><Button type="submit" variant="outline">Sair</Button></form></div>
  </details>;
}
