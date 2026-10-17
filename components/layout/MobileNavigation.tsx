"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "../ui/Button";
import { Sidebar } from "./Sidebar";
import { NavigationIcon } from "./NavigationIcon";
import type { DisplayUser } from "../../lib/auth/display-user";
import styles from "./dashboard.module.scss";

export function MobileNavigation({ user = null }: { user?: DisplayUser | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const pathname = usePathname();
  function close() { dialog.current?.close(); }
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 64rem)");
    const resized = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener("change", resized);
    return () => media.removeEventListener("change", resized);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <Button ref={trigger} className={styles.mobileTrigger} variant="outline" aria-label="Abrir menu de navegação" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => {
      dialog.current?.showModal(); setOpen(true); dialog.current?.querySelector("button")?.focus();
    }}><NavigationIcon name="menu" /></Button>
    <dialog ref={dialog} id={id} className={styles.drawer} aria-label="Menu de navegação" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => {
      setOpen(false);
      if (window.matchMedia("(min-width: 64rem)").matches) document.getElementById("dashboard-content")?.focus();
      else trigger.current?.focus();
    }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.drawerPanel}>
        <Button className={styles.drawerClose} variant="outline" aria-label="Fechar menu de navegação" onClick={close}><NavigationIcon name="close" /></Button>
        <Sidebar onNavigate={close} user={user} />
      </div>
    </dialog>
  </>;
}
