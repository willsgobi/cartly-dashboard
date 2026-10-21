"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { companyInformationSchema, informationChanges, type CompanyDetails, type CompanyInformationValues } from "./schemas";
import { saveCompanyInformation, settingsError } from "./api";
import { formatCnpj } from "../format";
import styles from "./settings.module.scss";

export function CompanyInformationForm({ company, disabled, onBusyChange, onSaved }: {
  company: CompanyDetails; disabled: boolean; onBusyChange: (busy: boolean) => void; onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const { name, document } = company;
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<CompanyInformationValues>({
    resolver: zodResolver(companyInformationSchema), defaultValues: { name },
  });
  const values = useWatch({ control });
  const parsed = companyInformationSchema.safeParse(values);
  const changed = parsed.success && Object.keys(informationChanges(parsed.data, company)).length > 0;
  useEffect(() => { reset({ name }); }, [name, reset]);
  useEffect(() => () => pending.current?.abort(), []);

  async function submit(values: CompanyInformationValues) {
    if (disabled || inFlight.current) return;
    const body = informationChanges(values, company);
    if (!Object.keys(body).length) return;
    inFlight.current = true; onBusyChange(true); setError(undefined);
    const controller = new AbortController(); pending.current = controller;
    try {
      const saved = await saveCompanyInformation(company.id, body, controller.signal);
      if (controller.signal.aborted) return;
      reset({ name: saved.name });
      onSaved();
    } catch (failure) { if (!controller.signal.aborted) setError(settingsError(failure, "company")); }
    finally { if (!controller.signal.aborted) { inFlight.current = false; onBusyChange(false); } }
  }
  return <form className={styles.form} aria-label="Dados da empresa" method="post" noValidate aria-busy={isSubmitting}
    onSubmit={(event) => { void handleSubmit(submit)(event); }}>
    <fieldset className={styles.fields} disabled={disabled || isSubmitting}>
      <legend className={styles.legend}>Dados da empresa</legend>
      <Input label="Razão social" autoComplete="organization" required error={errors.name?.message} {...register("name")} />
      <Input label="CNPJ" name="document" value={formatCnpj(document)} readOnly />
    </fieldset>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      <Button variant="text" disabled={disabled || isSubmitting} onClick={() => { reset({ name }); setError(undefined); }}>Cancelar</Button>
      <Button className={styles.save} type="submit" loading={isSubmitting} disabled={disabled || !changed}>Salvar alterações</Button>
    </div>
  </form>;
}
