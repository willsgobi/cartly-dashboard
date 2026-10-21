"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { lookupCompanyData } from "../onboarding/api";
import { digitsOnly, zipCodeSchema } from "../onboarding/schemas";
import { addressFormSchema, addressValues, addressChanges, type AddressValues, type CompanyAddress } from "./schemas";
import { saveCompanyAddress, settingsError } from "./api";
import styles from "./settings.module.scss";

const lookupFields = ["street", "city", "state"] as const;
type LookupField = typeof lookupFields[number];
export function CompanyAddressForm({ companyId, address, onClose, onSaved, onBusyChange }: {
  companyId: string; address: CompanyAddress; onClose: () => void; onSaved: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const hint = useId();
  const [error, setError] = useState<string>();
  const [lookup, setLookup] = useState<{ loading: boolean; message: string; failed: boolean }>({ loading: false, message: "", failed: false });
  const mutation = useRef<AbortController | null>(null);
  const lookupController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const versions = useRef<Record<LookupField, number>>({ street: 0, city: 0, state: 0 });
  const inFlight = useRef(false);
  const { register, handleSubmit, reset, getValues, setValue, trigger, control, formState: { errors, isSubmitting } } = useForm<AddressValues>({
    resolver: zodResolver(addressFormSchema), defaultValues: addressValues(address),
  });
  const values = useWatch({ control });
  const zipField = register("zipCode");
  const streetField = register("street");
  const cityField = register("city");
  const stateField = register("state");
  const parsed = addressFormSchema.safeParse(values);
  const changed = parsed.success && Object.keys(addressChanges(parsed.data, address)).length > 0;
  useEffect(() => () => { mutation.current?.abort(); lookupController.current?.abort(); }, []);
  function cancelLookup() { lookupController.current?.abort(); lookupController.current = null; generation.current++; setLookup({ loading: false, message: "", failed: false }); }
  async function findZip() {
    if (inFlight.current || lookupController.current) return;
    const parsedZip = zipCodeSchema.safeParse(getValues("zipCode"));
    if (!parsedZip.success) { await trigger("zipCode", { shouldFocus: true }); return; }
    const zip = parsedZip.data;
    const controller = new AbortController(); lookupController.current = controller;
    const request = ++generation.current;
    const snapshot = { ...versions.current };
    setLookup({ loading: true, message: "Consultando CEP...", failed: false });
    try {
      const fields = await lookupCompanyData("cep", zip, controller.signal, "/dashboard/settings/company");
      if (controller.signal.aborted || request !== generation.current || digitsOnly(getValues("zipCode")) !== zip) return;
      for (const field of lookupFields) {
        const value = fields[`address.${field}`]?.trim();
        if (value && snapshot[field] === versions.current[field]) setValue(field, value, { shouldDirty: true, shouldValidate: true });
      }
      setValue("zipCode", zip, { shouldDirty: true, shouldValidate: true });
      setLookup({ loading: false, message: "Endereço encontrado. Confira os dados.", failed: false });
    } catch {
      if (!controller.signal.aborted && request === generation.current) setLookup({ loading: false, message: "CEP não encontrado ou indisponível. Informe o endereço manualmente.", failed: true });
    } finally {
      if (lookupController.current === controller) lookupController.current = null;
    }
  }
  async function submit(values: AddressValues) {
    if (inFlight.current) return;
    const body = addressChanges(values, address);
    if (!Object.keys(body).length) return;
    inFlight.current = true; onBusyChange(true); cancelLookup(); setError(undefined);
    const controller = new AbortController(); mutation.current = controller;
    try {
      await saveCompanyAddress(companyId, address.id, body, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (failure) { if (!controller.signal.aborted) setError(settingsError(failure)); }
    finally { if (!controller.signal.aborted) { inFlight.current = false; onBusyChange(false); } }
  }
  return <Modal title="Editar endereço" busy={isSubmitting} onClose={onClose}>
    <form method="post" noValidate aria-label="Editar endereço" className={styles.form} aria-busy={isSubmitting}
      onSubmit={(event) => { void handleSubmit(submit)(event); }}>
      <fieldset className={styles.fields} disabled={isSubmitting}>
        <legend className={styles.legend}>Endereço da empresa</legend>
        <Input label="CEP" required inputMode="numeric" autoComplete="postal-code" error={errors.zipCode?.message}
          {...zipField} onChange={(event) => { cancelLookup(); void zipField.onChange(event); }} />
        <Button variant="secondary" disabled={lookup.loading || isSubmitting} loading={lookup.loading} onClick={() => { void findZip(); }}>Consultar CEP</Button>
        {lookup.message && <p role={lookup.failed ? "alert" : "status"}>{lookup.message}</p>}
        <Input label="Rua" autoComplete="address-line1" required error={errors.street?.message} {...streetField} onChange={(event) => { versions.current.street++; void streetField.onChange(event); }} />
        <Input label="Número" value={address.number} readOnly aria-describedby={hint} />
        <p id={hint} className={styles.hint}>O número deste endereço não pode ser alterado por aqui.</p>
        <Input label="Cidade" autoComplete="address-level2" required error={errors.city?.message} {...cityField} onChange={(event) => { versions.current.city++; void cityField.onChange(event); }} />
        <Input label="Estado" autoComplete="address-level1" required error={errors.state?.message} {...stateField} onChange={(event) => { versions.current.state++; void stateField.onChange(event); }} />
        <Input label="País" autoComplete="country-name" required error={errors.country?.message} {...register("country")} />
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <Button variant="text" disabled={isSubmitting} onClick={() => { cancelLookup(); reset(addressValues(address)); onClose(); }}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={!changed}>Salvar alterações</Button>
      </div>
    </form>
  </Modal>;
}
