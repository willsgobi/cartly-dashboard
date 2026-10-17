"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { categoryFormSchema, type Category, type CreateCategory } from "./schemas";
import { categoryErrorMessage, saveCategory } from "./api";
import styles from "./categories.module.scss";

export function CategoryForm({ companyId, category, onClose, onSaved }: { companyId: string; category?: Category; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const { register, handleSubmit, formState: { errors } } = useForm<CreateCategory>({ resolver: zodResolver(categoryFormSchema), defaultValues: { name: category?.name ?? "" } });
  async function submit(values: CreateCategory) {
    if (inFlight.current) return;
    if (category && values.name === category.name.trim()) { onClose(); return; }
    inFlight.current = true; setBusy(true); setError(undefined);
    const pending = new AbortController(); controller.current = pending;
    try {
      await saveCategory(companyId, values, category?.id, pending.signal);
      if (!pending.signal.aborted) onSaved();
    } catch (failure) { if (!pending.signal.aborted) setError(categoryErrorMessage(failure)); }
    finally { if (!pending.signal.aborted) { setBusy(false); inFlight.current = false; } }
  }
  return <Modal title={category ? "Editar categoria" : "Nova categoria"} busy={busy} onClose={onClose}>
    <form className={styles.form} onSubmit={(event) => { void handleSubmit(submit)(event); }} noValidate aria-busy={busy}>
      <Input label="Nome da categoria" required {...register("name")} error={errors.name?.message} disabled={busy} />
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" loading={busy}>{category ? "Salvar alterações" : "Criar categoria"}</Button></div>
    </form>
  </Modal>;
}
