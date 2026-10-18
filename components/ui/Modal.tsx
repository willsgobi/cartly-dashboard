"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import styles from "./Modal.module.scss";

/** Mount while open. Native dialog provides focus containment and inert background. */
export function Modal({ title, children, busy = false, onClose }: { title: string; children: ReactNode; busy?: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    element?.querySelector<HTMLElement>("input, [data-initial-focus]")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      else document.querySelector<HTMLElement>("[data-modal-fallback]")?.focus();
    };
  }, []);
  return <dialog ref={dialog} className={styles.modal} aria-labelledby={titleId} aria-busy={busy}
    onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (!busy && event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <div className={styles.heading}><h2 id={titleId}>{title}</h2><Button variant="outline" aria-label="Fechar diálogo" disabled={busy} onClick={onClose}>Fechar</Button></div>
    {children}
  </dialog>;
}
