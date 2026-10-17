"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { productError, removeProduct } from "./api";
import type { Product } from "./schemas";
import styles from "./products.module.scss";

export function DeleteProductDialog({ companyId, product, onClose, onDeleted }: { companyId: string; product: Product; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(undefined);
    const controller = new AbortController(); pending.current = controller;
    try { await removeProduct(companyId, product.id, controller.signal); if (!controller.signal.aborted) onDeleted(); }
    catch (failure) { if (!controller.signal.aborted) setError(productError(failure)); }
    finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(false); } }
  }
  return <Modal title="Excluir produto" busy={busy} onClose={onClose}><div className={styles.form}>
    <p>Deseja excluir <strong>{product.name}</strong>? O produto será removido da listagem de produtos ativos. Seus registros relacionados serão preservados.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><Button data-initial-focus className={styles.compact} variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button className={`${styles.compact} ${styles.deleteButton}`} loading={busy} onClick={confirm}>Excluir produto</Button></div>
  </div></Modal>;
}
