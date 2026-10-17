"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { categoryErrorMessage, removeCategory } from "./api";
import type { Category } from "./schemas";
import styles from "./categories.module.scss";

export function DeleteCategoryDialog({ companyId, category, onClose, onDeleted }: { companyId: string; category: Category; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(undefined);
    const pending = new AbortController(); controller.current = pending;
    try { await removeCategory(companyId, category.id, pending.signal); if (!pending.signal.aborted) onDeleted(); }
    catch (failure) { if (!pending.signal.aborted) setError(categoryErrorMessage(failure, true)); }
    finally { if (!pending.signal.aborted) { inFlight.current = false; setBusy(false); } }
  }
  return <Modal title="Excluir categoria" busy={busy} onClose={onClose}>
    <div className={styles.form}><p>Deseja excluir a categoria <strong>{category.name}</strong>? Esta exclusão é permanente.</p><p>Categorias com produtos vinculados não podem ser excluídas. A exclusão requer permissão de administrador.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><Button data-initial-focus variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button className={styles.deleteButton} loading={busy} onClick={confirm}>Excluir categoria</Button></div>
    </div>
  </Modal>;
}
