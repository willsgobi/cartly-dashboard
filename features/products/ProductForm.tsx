"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import type { Category } from "../categories/schemas";
import { productFormSchema, typeLabels, validProductState, type Product, type ProductFormValues, type ProductUpdate } from "./schemas";
import { productError, saveProduct } from "./api";
import styles from "./products.module.scss";

export function ProductForm({ companyId, product, categories, onClose, onSaved, onBusyChange }: { companyId: string; product?: Product; categories: Category[]; onClose: () => void; onSaved: () => void; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const categoryInputId = useId();
  const descriptionId = useId();
  const { register, handleSubmit, setFocus, setError: fieldError, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema), defaultValues: { name: product?.name ?? "", description: product?.description ?? "", categoryId: product?.categoryId ?? "", type: product?.type ?? "NORMAL", price: product?.price?.toString().replace(".", ",") ?? "" },
  });
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { setFocus("name"); }, [setFocus]);
  async function submit(values: ProductFormValues) {
    if (inFlight.current) return;
    if (!product && values.type !== "NORMAL") { setError("A criação de produtos com variações ainda não está disponível."); return; }
    if (!categories.some((category) => category.companyId === companyId && category.id === values.categoryId)) { fieldError("categoryId", { message: "Selecione uma categoria disponível." }); return; }
    const price = values.type === "VARIANT_WITH_PRICE" ? null : Number(values.price.trim().replace(",", "."));
    if (product && (!validProductState(product) || values.type !== product.type)) { setError("Esta alteração depende da gestão de variações, que ainda não está disponível."); return; }
    const body: ProductUpdate = {};
    if (product) {
      if (values.name !== product.name.trim()) body.name = values.name;
      if (values.description !== (product.description ?? "").trim()) body.description = values.description;
      if (values.categoryId !== product.categoryId) body.categoryId = values.categoryId;
      if (price !== product.price) body.price = price;
      if (!Object.keys(body).length) { onClose(); return; }
    }
    inFlight.current = true; setBusy(true); onBusyChange(true); setError(undefined);
    const controller = new AbortController(); pending.current = controller;
    try {
      await saveProduct(companyId, product ? body : { name: values.name, ...(values.description ? { description: values.description } : {}), categoryId: values.categoryId, type: "NORMAL", price }, product?.id, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (failure) { if (!controller.signal.aborted) setError(productError(failure)); }
    finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(false); onBusyChange(false); } }
  }
  return <form className={styles.form} noValidate aria-busy={busy} onSubmit={(event) => { void handleSubmit(submit)(event); }}>
    <Input label="Nome do produto" required disabled={busy} {...register("name")} error={errors.name?.message} />
    <div className={styles.field}><label htmlFor={descriptionId}>Descrição</label><textarea id={descriptionId} rows={3} disabled={busy} {...register("description")} /></div>
    <div className={styles.field}><label htmlFor={categoryInputId}>Categoria *</label><select id={categoryInputId} required disabled={busy || !categories.length} {...register("categoryId")} aria-invalid={!!errors.categoryId} aria-describedby={errors.categoryId ? `${categoryInputId}-error` : undefined}>
      <option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select>{errors.categoryId && <p id={`${categoryInputId}-error`} role="alert" className={styles.error}>{errors.categoryId.message}</p>}</div>
    {!categories.length && <p role="status">Cadastre uma categoria antes de criar produtos. <a href="/dashboard/categories">Gerenciar categorias</a></p>}
    <Input label="Tipo" value={typeLabels[product?.type ?? "NORMAL"]} readOnly />
    <p className={styles.hint}>{product ? "O tipo e as variações são preservados nesta edição." : "A criação de produtos com variações estará disponível em uma próxima etapa."}</p>
    {product?.type === "VARIANT_WITH_PRICE" ? <p>Os preços são definidos nas variações existentes.</p> : <Input label="Preço (R$)" inputMode="decimal" placeholder="0,00" required disabled={busy} {...register("price")} error={errors.price?.message} />}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><Button className={styles.compact} variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button className={styles.compact} type="submit" loading={busy} disabled={!categories.length}>{product ? "Salvar alterações" : "Criar produto"}</Button></div>
  </form>;
}
