"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/Button";
import { useActiveCompany } from "../ActiveCompanyContext";
import { fetchCompanyDetails, settingsError } from "./api";
import type { CompanyDetails } from "./schemas";
import { CompanyInformationForm } from "./CompanyInformationForm";
import { CompanyAddressForm } from "./CompanyAddressForm";
import styles from "./settings.module.scss";

export function CompanySettingsManager() {
  const { activeCompany } = useActiveCompany();
  // Also key this local boundary for callers outside the F06 keyed provider.
  return activeCompany ? <SettingsContent key={activeCompany.id} companyId={activeCompany.id} /> : <p>Selecione uma empresa para acessar as configurações.</p>;
}
function SettingsContent({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<CompanyDetails>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(null);
  const addressTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetchCompanyDetails(companyId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setDetails(data);
    }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(settingsError(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, revision]);
  function refresh() { setLoading(true); setError(undefined); setRevision((value) => value + 1); }
  function saved(companyChanged: boolean) {
    setSuccess(companyChanged ? "Dados da empresa atualizados com sucesso." : "Endereço atualizado com sucesso.");
    if (!companyChanged) setAddressId(null);
    refresh();
    // Refresh F06's authoritative server list/header, retaining the selected ID and local form state.
    if (companyChanged) router.refresh();
  }
  const disabled = busy || loading || !!error;
  useEffect(() => { if (addressId === null && !disabled) addressTrigger.current?.focus(); }, [addressId, disabled]);
  const selectedAddress = details?.addresses.find((address) => address.id === addressId);
  return <section className={styles.container} aria-label="Configurações da empresa">
    <div><h2>Configurações da empresa</h2><p>Gerencie os dados e os endereços da empresa ativa.</p></div>
    {success && <p role="status" className={styles.success}>{success}</p>}
    {loading && <p role="status">Carregando dados da empresa...</p>}
    {error && <div className={styles.form}><p role="alert" className={styles.error}>{error}</p><Button variant="outline" onClick={refresh} disabled={busy}>Tentar novamente</Button></div>}
    {details && <>
      <section className={styles.card} aria-labelledby="company-information-title">
        <h3 id="company-information-title">Dados da empresa</h3>
        <CompanyInformationForm company={details} disabled={disabled} onBusyChange={setBusy} onSaved={() => saved(true)} />
      </section>
      <section className={styles.card} aria-labelledby="company-addresses-title">
        <h3 id="company-addresses-title">Endereços</h3>
        {!details.addresses.length ? <p>Nenhum endereço cadastrado para esta empresa.</p> : <ul className={styles.addresses}>
          {details.addresses.map((address, index) => <li key={address.id} className={styles.address}>
            <div><h4>Endereço {index + 1}</h4><p>{address.street}, {address.number}</p><p>{address.city} — {address.state}</p><p>CEP: {address.zipCode} · {address.country}</p></div>
            <Button variant="outline" disabled={disabled} aria-label={`Editar endereço ${index + 1}`} onClick={(event) => { addressTrigger.current = event.currentTarget; setAddressId(address.id); setSuccess(undefined); }}>Editar endereço</Button>
          </li>)}
        </ul>}
      </section>
      {selectedAddress && <CompanyAddressForm key={selectedAddress.id} companyId={companyId} address={selectedAddress} onClose={() => setAddressId(null)} onBusyChange={setBusy} onSaved={() => saved(false)} />}
    </>}
  </section>;
}
