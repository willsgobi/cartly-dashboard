"use client";

import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../components/ui/Button";
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
  if (!companies.length) return <p className={styles.noCompany}>Nenhuma empresa selecionada</p>;
  return (
    <section className={[styles.workspace, compact ? styles.compact : ""].filter(Boolean).join(" ")} aria-label="Empresas">
      <h2>{activeCompany ? "Empresa ativa" : "Selecione sua empresa"}</h2>
      {activeCompany && <p role="status">{activeCompany.name}</p>}
      {companies.length === 1 ? (!compact && <p>Esta é a empresa disponível para sua conta.</p>) : (
        <form action="/api/companies/active" method="post" noValidate aria-busy={submitting} onSubmit={(event) => {
          const form = event.currentTarget;
          void handleSubmit(() => {
            if (inFlight.current) return;
            inFlight.current = true;
            setSubmitting(true);
            form.submit();
          })(event);
        }} className={styles.form}>
          <label htmlFor={id}>Empresa</label>
          <select id={id} defaultValue={activeCompany?.id ?? ""} required disabled={submitting} aria-invalid={!!errors.companyId} aria-describedby={errors.companyId ? `${id}-error` : undefined} {...register("companyId")}>
            <option value="" disabled>Selecione uma empresa</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name} — {company.document}</option>)}
          </select>
          {errors.companyId && <p id={`${id}-error`} role="alert" className={styles.error}>{errors.companyId.message}</p>}
          <Button type="submit" loading={submitting}>{activeCompany ? "Trocar empresa" : "Continuar"}</Button>
        </form>
      )}
    </section>
  );
}
