"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/api/errors";
import { createCompany } from "./api";
import { createCompanySchema, type CompanyFormValues, type CreationResult } from "./schemas";
import { useOnboardingLookups } from "./useOnboardingLookups";
import styles from "./onboarding.module.scss";

export function CompanyOnboardingForm() {
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<CreationResult | null>(null);
  const inFlight = useRef(false);
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: { name: "", document: "", address: { street: "", number: "", city: "", state: "", zipCode: "", country: "Brazil" } },
  });
  const { register, handleSubmit, trigger, setFocus, formState: { errors, isSubmitting } } = form;
  const lookups = useOnboardingLookups(form);
  const busy = isSubmitting || !!created;
  useEffect(() => { setFocus(step === 1 ? "document" : "address.zipCode"); }, [step, setFocus]);

  async function next() {
    if (await trigger(["document", "name"], { shouldFocus: true })) { setStep(2); setMessage(""); }
  }

  async function submit(values: CompanyFormValues) {
    if (inFlight.current || created) return;
    inFlight.current = true;
    lookups.cancel();
    setMessage("");
    try {
      const result = await createCompany(createCompanySchema.parse(values));
      setCreated(result);
    } catch (error) {
      const text = error instanceof ApiError
        ? error.status === 409 ? "Já existe uma empresa com este CNPJ. Volte e confira o documento."
          : error.status === 400 ? "Confira os dados da empresa e do endereço antes de tentar novamente." : error.message
        : "Não foi possível criar a empresa. Tente novamente.";
      setMessage(text);
    } finally { inFlight.current = false; }
  }

  return (
    <div className={styles.container}>
      <p role="status">Etapa {step} de 2 — {step === 1 ? "Dados da empresa" : "Endereço da empresa"}</p>
      <p className={styles.hint}>As consultas são opcionais. Você pode preencher e corrigir todos os campos manualmente.</p>
      <form method="post" aria-label="Cadastro de empresa" className={styles.form} noValidate aria-busy={isSubmitting} onSubmit={(event) => {
        if (step === 1) { event.preventDefault(); void next(); }
        else void handleSubmit(submit, (invalid) => {
          if (invalid.document || invalid.name) { setStep(1); setTimeout(() => setFocus(invalid.document ? "document" : "name"), 0); }
        })(event);
      }}>
        <fieldset hidden={step !== 1} disabled={busy} className={styles.fields}>
          <legend>Dados da empresa</legend>
          <Input label="CNPJ" inputMode="numeric" required autoComplete="off" error={errors.document?.message} {...register("document", { onChange: () => lookups.edited("document") })} />
          <Button variant="secondary" loading={lookups.feedback.cnpj.loading} disabled={busy} onClick={() => { void lookups.lookup("cnpj", true); }}>Consultar CNPJ</Button>
          {lookups.feedback.cnpj.message && <p role={lookups.feedback.cnpj.failed ? "alert" : "status"}>{lookups.feedback.cnpj.message}</p>}
          <Input label="Razão social" required autoComplete="organization" error={errors.name?.message} {...register("name", { onChange: () => lookups.edited("name") })} />
          <Button onClick={() => { void next(); }} disabled={busy}>Continuar</Button>
        </fieldset>
        <fieldset hidden={step !== 2} disabled={busy} className={styles.fields}>
          <legend>Endereço da empresa</legend>
          <Input label="CEP" inputMode="numeric" autoComplete="postal-code" required error={errors.address?.zipCode?.message} {...register("address.zipCode", { onChange: () => lookups.edited("address.zipCode"), onBlur: () => { void lookups.lookup("cep"); } })} />
          <Button variant="secondary" loading={lookups.feedback.cep.loading} disabled={busy} onClick={() => { void lookups.lookup("cep", true); }}>Consultar CEP</Button>
          {lookups.feedback.cep.message && <p role={lookups.feedback.cep.failed ? "alert" : "status"}>{lookups.feedback.cep.message}</p>}
          <Input label="Logradouro" autoComplete="address-line1" required error={errors.address?.street?.message} {...register("address.street", { onChange: () => lookups.edited("address.street") })} />
          <Input label="Número" required error={errors.address?.number?.message} {...register("address.number", { onChange: () => lookups.edited("address.number") })} />
          <Input label="Cidade" autoComplete="address-level2" required error={errors.address?.city?.message} {...register("address.city", { onChange: () => lookups.edited("address.city") })} />
          <Input label="Estado" autoComplete="address-level1" required error={errors.address?.state?.message} {...register("address.state", { onChange: () => lookups.edited("address.state") })} />
          <Input label="País" autoComplete="country-name" required error={errors.address?.country?.message} {...register("address.country", { onChange: () => lookups.edited("address.country") })} />
          <div className={styles.actions}><Button variant="outline" disabled={busy} onClick={() => setStep(1)}>Voltar</Button><Button type="submit" loading={isSubmitting} disabled={busy}>Criar empresa</Button></div>
        </fieldset>
        {message && <p role="alert" className={styles.error}>{message}</p>}
      </form>
      {created && (created.active ? <p role="status">Empresa criada. Abrindo o painel...</p> : (
        <div className={styles.container}>
          <p role="status">Empresa criada. Não foi possível confirmar o acesso agora. Verifique seu acesso para continuar, sem repetir o cadastro.</p>
          <form action="/api/companies/active" method="post"><input type="hidden" name="companyId" value={created.companyId} /><Button type="submit">Verificar acesso e continuar</Button></form>
        </div>
      ))}
    </div>
  );
}
