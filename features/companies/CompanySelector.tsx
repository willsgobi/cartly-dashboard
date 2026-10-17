"use client";

import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActiveCompany } from "./ActiveCompanyContext";
import { companySelectionSchema, type CompanySelectionValues } from "./schemas";
import styles from "./companies.module.scss";

export function CompanySelector({ compact = false }: { compact?: boolean }) {
  const { companies, activeCompany } = useActiveCompany();
  const id = useId();
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<CompanySelectionValues>({
    resolver: zodResolver(companySelectionSchema), defaultValues: { companyId: activeCompany?.id ?? "" },
  });
  const field = register("companyId");

  async function selectCompany(form: HTMLFormElement) {
    if (inFlight.current) return;
    inFlight.current = true;
    await handleSubmit(() => {
      // Capture the enabled select in the native POST before React renders the loading state.
      setSubmitting(true);
      form.submit();
    }, () => { inFlight.current = false; })();
  }
  if (!companies.length) return <p className={styles.noCompany}>Nenhuma empresa selecionada</p>;
  return (
    <section className={[styles.workspace, compact ? styles.compact : ""].filter(Boolean).join(" ")} aria-label="Empresas">
      <h2>{activeCompany ? "Empresa ativa" : "Selecione sua empresa"}</h2>
      {activeCompany && <p role="status">{activeCompany.name}</p>}
      {companies.length === 1 ? (!compact && <p>Esta é a empresa disponível para sua conta.</p>) : (
        <form action="/api/companies/active" method="post" noValidate aria-busy={submitting} onSubmit={(event) => {
          const form = event.currentTarget;
          event.preventDefault();
          void selectCompany(form);
        }} className={styles.form}>
          <label htmlFor={id}>Empresa</label>
          <select id={id} defaultValue={activeCompany?.id ?? ""} required disabled={submitting} aria-invalid={!!errors.companyId} aria-describedby={errors.companyId ? `${id}-error` : undefined} {...field} onChange={async (event) => {
            const form = event.currentTarget.form;
            const value = event.currentTarget.value;
            await field.onChange(event);
            if (form && value !== activeCompany?.id) await selectCompany(form);
          }}>
            <option value="" disabled>Selecione uma empresa</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name} — {company.document}</option>)}
          </select>
          {errors.companyId && <p id={`${id}-error`} role="alert" className={styles.error}>{errors.companyId.message}</p>}
          {submitting && <p role="status">Alterando empresa...</p>}
        </form>
      )}
    </section>
  );
}
