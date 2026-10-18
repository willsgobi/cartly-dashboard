"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import type { Category } from "../categories/schemas";
import { creationPayload, editProductFormSchema, productFormSchema, productTypes, typeLabels, validProductState, type Product, type ProductFormValues, type ProductUpdate } from "./schemas";
import { parsePrice } from "./prices";
import { VariantFields, variantArrayError } from "./VariantFields";
import { productError, saveProduct } from "./api";
import styles from "./products.module.scss";

export function ProductForm({ companyId, product, categories, onClose, onSaved, onBusyChange }: { companyId: string; product?: Product; categories: Category[]; onClose: () => void; onSaved: () => void; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const categoryInputId = useId();
  const descriptionId = useId();
  const { register, control, handleSubmit, setFocus, setError: fieldError, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(product ? editProductFormSchema : productFormSchema), defaultValues: { name: product?.name ?? "", description: product?.description ?? "", categoryId: product?.categoryId ?? "", type: product?.type ?? "NORMAL", price: product?.price?.toString().replace(".", ",") ?? "", variants: [] },
  });
  const selectedType = useWatch({ control, name: "type" });
  const { fields, append, remove } = useFieldArray({ control, name: "variants" });
  const typeId = useId();
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { setFocus("name"); }, [setFocus]);
  async function submit(values: ProductFormValues) {
    if (inFlight.current) return;
    if (!categories.some((category) => category.companyId === companyId && category.id === values.categoryId)) { fieldError("categoryId", { message: "Selecione uma categoria disponível." }); return; }
    const price = values.type === "VARIANT_WITH_PRICE" ? null : parsePrice(values.price);
    if (product && (!validProductState(product) || values.type !== product.type)) { setError("A edição do produto deve preservar seu tipo e suas variantes. Gerencie as variantes pelos detalhes."); return; }
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
      await saveProduct(companyId, product ? body : creationPayload(values), product?.id, controller.signal);
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
    {product ? <><Input label="Tipo" value={typeLabels[product.type]} readOnly /><p className={styles.hint}>O tipo e as variantes são preservados nesta edição.</p></> : <div className={styles.field}><label htmlFor={typeId}>Tipo</label><select id={typeId} disabled={busy} {...register("type")}>{productTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div>}
    {selectedType === "VARIANT_WITH_PRICE" ? <p>Os preços são definidos nas variantes.</p> : <Input label={selectedType === "VARIANT" ? "Preço compartilhado (R$)" : "Preço (R$)"} inputMode="decimal" placeholder="0,00" required disabled={busy} {...register("price")} error={errors.price?.message} />}
    {!product && selectedType !== "NORMAL" && <section className={styles.form} aria-label="Variantes iniciais"><h3>Variantes</h3>{selectedType === "VARIANT" && <p className={styles.hint}>Todas as variantes usam o preço compartilhado.</p>}{fields.map((field, index) => <fieldset key={field.id} className={styles.variantRow}><legend>Variante {index + 1}</legend><VariantFields nameField={register(`variants.${index}.name`)} priceField={register(`variants.${index}.price`)} individualPrice={selectedType === "VARIANT_WITH_PRICE"} disabled={busy} nameError={errors.variants?.[index]?.name?.message} priceError={errors.variants?.[index]?.price?.message} /><Button className={styles.compact} variant="outline" disabled={busy} aria-label={`Remover variante ${index + 1}`} onClick={() => remove(index)}>Remover variante</Button></fieldset>)}{variantArrayError(errors) && <p role="alert" className={styles.error}>{variantArrayError(errors)}</p>}<Button className={styles.compact} variant="outline" disabled={busy} onClick={() => append({ name: "", price: "" })}>Adicionar variante</Button><p className={styles.hint}>Os nomes e preços digitados são preservados ao trocar o tipo. Apenas os campos aplicáveis serão enviados.</p></section>}
    {!product && selectedType === "NORMAL" && fields.length > 0 && <p role="status" className={styles.hint}>As variantes preenchidas estão preservadas no formulário e não serão enviadas para um produto normal.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><Button className={styles.compact} variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button className={styles.compact} type="submit" loading={busy} disabled={!categories.length}>{product ? "Salvar alterações" : "Criar produto"}</Button></div>
  </form>;
}
