"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { VariantFields } from "./VariantFields";
import { addVariant, patchVariant, productError, removeVariant, variantError } from "./api";
import { parsePrice } from "./prices";
import { currency, type Product, type ProductVariant, type VariantUpdate } from "./schemas";
import styles from "./products.module.scss";

const variantFormSchema = z.object({ name: z.string().trim().min(1, "Informe o nome da variante."), price: z.string(), individualPrice: z.boolean() }).superRefine((values, context) => {
  if (values.individualPrice && parsePrice(values.price) === undefined) context.addIssue({ code: "custom", path: ["price"], message: "Informe um preço maior que zero, como 12,50, sem perda de precisão." });
});
type Values = z.infer<typeof variantFormSchema>;

export function VariantManagement({ product, companyId, busy, onBusyChange, onCommitted }: { product: Product; companyId: string; busy: boolean; onBusyChange: (value: boolean) => void; onCommitted: (message: string) => void }) {
  const [action, setAction] = useState<"add" | ProductVariant | null>(null);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const actionPanel = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const { register, handleSubmit, reset, setFocus, formState: { errors } } = useForm<Values>({ resolver: zodResolver(variantFormSchema), defaultValues: { name: "", price: "", individualPrice: product.type === "VARIANT_WITH_PRICE" } });
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (busy) return; if (editing) setFocus("name"); else if (action === "add") setFocus("name"); else if (action) actionPanel.current?.querySelector<HTMLButtonElement>("[data-cancel-variant]")?.focus(); else if (editTrigger.current?.isConnected) { editTrigger.current.focus(); editTrigger.current = null; } else addButton.current?.focus(); }, [action, editing, busy, setFocus]);
  function cancel() { setAction(null); setError(undefined); }
  function closeEdit() { setEditing(null); setError(undefined); reset(); }
  async function mutate(operation: (signal: AbortSignal) => Promise<void>, message: string) {
    if (inFlight.current) return;
    inFlight.current = true; onBusyChange(true); setError(undefined);
    const controller = new AbortController(); pending.current = controller;
    try {
      await operation(controller.signal);
      if (!controller.signal.aborted) { setAction(null); setEditing(null); reset(); onCommitted(message); }
    } catch (failure) { if (!controller.signal.aborted) setError(editing ? productError(failure) : variantError(failure)); }
    finally { if (!controller.signal.aborted) { inFlight.current = false; onBusyChange(false); } }
  }
  async function create(values: Values) {
    if (editing) {
      const body: VariantUpdate = {};
      if (values.name !== editing.name.trim()) body.name = values.name;
      if (product.type === "VARIANT_WITH_PRICE") {
        const price = parsePrice(values.price);
        if (price === undefined) return;
        if (price !== editing.price) body.price = price;
      }
      if (!Object.keys(body).length) { closeEdit(); return; }
      await mutate((signal) => patchVariant(companyId, product.id, editing.id, body, signal), "Variante atualizada com sucesso.");
      return;
    }
    const price = product.type === "VARIANT" ? null : parsePrice(values.price);
    if (price === undefined) return;
    await mutate((signal) => addVariant(companyId, product.id, { name: values.name, price }, signal), "Variante adicionada com sucesso.");
  }
  if (product.type === "NORMAL") return null;
  const variantForm = <form className={styles.variantRow} onSubmit={(event) => { void handleSubmit(create)(event); }} noValidate aria-busy={busy} aria-label={editing ? "Editar variante" : "Adicionar variante"}><VariantFields nameField={register("name")} priceField={register("price")} individualPrice={product.type === "VARIANT_WITH_PRICE"} disabled={busy} nameError={errors.name?.message} priceError={errors.price?.message} />{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><Button className={styles.compact} variant="outline" disabled={busy} onClick={editing ? closeEdit : cancel}>Cancelar</Button><Button className={styles.compact} type="submit" loading={busy}>{editing ? "Salvar alterações" : "Salvar variante"}</Button></div></form>;
  return <section className={styles.form} aria-label="Gerenciar variantes"><div className={styles.toolbar}><h3>Variantes</h3><Button ref={addButton} className={styles.compact} variant="outline" disabled={busy || action !== null || editing !== null} onClick={() => { setError(undefined); setAction("add"); }}>Adicionar variante</Button></div>
    {product.type === "VARIANT" && <p>Preço compartilhado: {currency(product.price)}</p>}
    {!product.variants.length && <p role="alert" className={styles.error}>Este produto está sem variantes. Adicione uma variante para restabelecer a configuração esperada.</p>}
    <ul className={styles.variantList}>{product.variants.map((variant) => <li key={variant.id}><span>{variant.name}{product.type === "VARIANT_WITH_PRICE" ? ` — ${currency(variant.price)}` : ""}</span><div className={styles.actions}><Button className={styles.compact} variant="outline" disabled={busy || action !== null || editing !== null} aria-label={`Editar variante ${variant.name}`} onClick={(event) => { editTrigger.current = event.currentTarget; reset({ name: variant.name, price: variant.price?.toString().replace(".", ",") ?? "", individualPrice: product.type === "VARIANT_WITH_PRICE" }); setError(undefined); setEditing(variant); }}>Editar</Button><Button className={styles.compact} variant="outline" disabled={busy || action !== null || editing !== null} aria-label={`Excluir variante ${variant.name}`} onClick={() => { setError(undefined); setAction(variant); }}>Excluir</Button></div></li>)}</ul>
    {action === "add" && variantForm}
    {editing && <Modal title="Editar variante" busy={busy} onClose={closeEdit}>{variantForm}</Modal>}
    {action && action !== "add" && <div ref={actionPanel} className={styles.variantRow} role="group" aria-label="Confirmar exclusão da variante"><p>Deseja excluir a variante <strong>{action.name}</strong>? Esta exclusão é permanente.</p>{product.variants.length === 1 && <p role="alert" className={styles.error}>Esta é a última variante. A exclusão deixará o produto sem variantes, contrariando sua configuração esperada.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><Button data-cancel-variant className={styles.compact} variant="outline" disabled={busy} onClick={cancel}>Cancelar</Button><Button className={`${styles.compact} ${styles.deleteButton}`} loading={busy} onClick={() => void mutate((signal) => removeVariant(companyId, product.id, action.id, signal), "Variante excluída permanentemente.")}>Excluir variante</Button></div></div>}
  </section>;
}
