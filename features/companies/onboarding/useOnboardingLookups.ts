"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ApiError } from "../../../lib/api/errors";
import { lookupCompanyData } from "./api";
import { cnpjSchema, zipCodeSchema, digitsOnly, lookupFieldNames, type CompanyFormValues, type LookupField, type LookupKind } from "./schemas";

type Feedback = { loading: boolean; message: string; failed: boolean };
const empty: Feedback = { loading: false, message: "", failed: false };

export function useOnboardingLookups(form: UseFormReturn<CompanyFormValues>) {
  const [feedback, setFeedback] = useState({ cnpj: empty, cep: empty });
  const controllers = useRef<{ cnpj: AbortController | null; cep: AbortController | null }>({ cnpj: null, cep: null });
  const sequence = useRef({ cnpj: 0, cep: 0 });
  const addressSequence = useRef(0);
  const versions = useRef<Partial<Record<LookupField, number>>>({});
  const lastRequested = useRef({ cnpj: "", cep: "" });
  useEffect(() => {
    const current = controllers.current;
    return () => { current.cnpj?.abort(); current.cep?.abort(); };
  }, []);

  function edited(field: LookupField | "document") {
    if (field !== "document") versions.current[field] = (versions.current[field] ?? 0) + 1;
    if (field === "document" || field === "address.zipCode") {
      const kind = field === "document" ? "cnpj" : "cep";
      controllers.current[kind]?.abort();
      controllers.current[kind] = null;
      sequence.current[kind]++;
      lastRequested.current[kind] = "";
      if (kind === "cep") addressSequence.current++;
      setFeedback((state) => ({ ...state, [kind]: empty }));
    }
  }

  function cancel() {
    for (const kind of ["cnpj", "cep"] as const) {
      controllers.current[kind]?.abort();
      controllers.current[kind] = null;
      sequence.current[kind]++;
    }
    setFeedback((state) => ({ cnpj: { ...state.cnpj, loading: false }, cep: { ...state.cep, loading: false } }));
  }

  async function lookup(kind: LookupKind, explicit = false) {
    const source = kind === "cnpj" ? "document" : "address.zipCode";
    const parsed = (kind === "cnpj" ? cnpjSchema : zipCodeSchema).safeParse(form.getValues(source));
    if (!parsed.success) { await form.trigger(source); return; }
    if (controllers.current[kind] || (!explicit && lastRequested.current[kind] === parsed.data)) return;
    lastRequested.current[kind] = parsed.data;
    const controller = new AbortController();
    controllers.current[kind] = controller;
    const requestId = ++sequence.current[kind];
    const addressId = ++addressSequence.current;
    const snapshot = { ...versions.current };
    setFeedback((state) => ({ ...state, [kind]: { loading: true, failed: false, message: kind === "cnpj" ? "Consultando CNPJ..." : "Consultando CEP..." } }));
    try {
      const fields = await lookupCompanyData(kind, parsed.data, controller.signal);
      if (controller.signal.aborted || requestId !== sequence.current[kind] || digitsOnly(form.getValues(source)) !== parsed.data) return;
      let appliedZip = false;
      for (const field of lookupFieldNames) {
        if (kind === "cep" && !["address.street", "address.city", "address.state", "address.zipCode"].includes(field)) continue;
        if (field.startsWith("address.") && addressId !== addressSequence.current) continue;
        if ((versions.current[field] ?? 0) !== (snapshot[field] ?? 0)) continue;
        const value = fields[field]?.trim();
        if (!value) continue;
        form.setValue(field, value, { shouldDirty: true, shouldValidate: true });
        versions.current[field] = (versions.current[field] ?? 0) + 1;
        if (field === "address.zipCode") appliedZip = true;
      }
      if (kind === "cnpj" && appliedZip && fields["address.street"]?.trim() && fields["address.city"]?.trim() && fields["address.state"]?.trim()) {
        lastRequested.current.cep = digitsOnly(form.getValues("address.zipCode"));
      }
      setFeedback((state) => ({ ...state, [kind]: { loading: false, failed: false, message: kind === "cnpj" ? "Dados da empresa encontrados. Confira e complete os campos." : "Endereço encontrado. Confira os dados." } }));
    } catch (error) {
      if (controller.signal.aborted || requestId !== sequence.current[kind]) return;
      const message = error instanceof ApiError && error.status === 429
        ? "Limite de consultas atingido. Aguarde ou preencha os dados manualmente."
        : kind === "cnpj" ? "Não foi possível consultar o CNPJ. Preencha os dados manualmente." : "CEP não encontrado ou indisponível. Informe o endereço manualmente.";
      setFeedback((state) => ({ ...state, [kind]: { loading: false, failed: true, message } }));
    } finally {
      if (requestId === sequence.current[kind]) controllers.current[kind] = null;
    }
  }

  return { feedback, edited, lookup, cancel };
}
