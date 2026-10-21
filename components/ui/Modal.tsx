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
    <div className={styles.heading}><h2 id={titleId}>{title}</h2><Button className={styles.close} variant="text" aria-label="Fechar diálogo" disabled={busy} onClick={onClose}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12 M6 18L18 6" /></svg>
    </Button></div>
    {children}
  </dialog>;
}
