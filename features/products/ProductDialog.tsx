"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { fetchCategories } from "../categories/api";
import type { Category } from "../categories/schemas";
import { fetchProduct, productError } from "./api";
import { type Product, validProductState } from "./schemas";
import { ProductForm } from "./ProductForm";
import { ProductDetails } from "./ProductDetails";
import styles from "./products.module.scss";

export function ProductDialog({ companyId, mode, productId, onClose, onSaved }: { companyId: string; mode: "create" | "edit" | "details"; productId?: string; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<{ product?: Product; categories: Category[] }>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const pending = new AbortController();
    void Promise.all([productId ? fetchProduct(companyId, productId, pending.signal) : Promise.resolve(undefined), mode === "details" ? Promise.resolve([]) : fetchCategories(companyId, pending.signal)])
      .then(([product, categories]) => { if (!pending.signal.aborted) setData({ product, categories }); })
      .catch((failure: unknown) => { if (!pending.signal.aborted) setError(productError(failure)); });
    return () => pending.abort();
  }, [companyId, mode, productId, revision]);
  function retry() { setError(undefined); setRevision((value) => value + 1); }
  // The form reports its pending mutation so all dismissal controls stay locked.
  const [busy, setBusy] = useState(false);
  return <Modal title={mode === "create" ? "Novo produto" : mode === "edit" ? "Editar produto" : "Detalhes do produto"} busy={busy} onClose={onClose}>
    {error ? <div className={styles.form}><p role="alert" className={styles.error}>{error}</p><Button className={styles.compact} variant="outline" onClick={retry}>Tentar novamente</Button></div> : !data ? <p role="status">Carregando produto...</p>
      : mode === "details" && data.product ? <ProductDetails product={data.product} />
      : data.product && !validProductState(data.product) ? <p role="alert">Este produto possui uma configuração de preços ou variações que precisa ser corrigida antes da edição. A gestão de variações ainda não está disponível.</p>
      : <ProductForm companyId={companyId} product={data.product} categories={data.categories} onClose={onClose} onSaved={onSaved} onBusyChange={setBusy} />}
  </Modal>;
}
