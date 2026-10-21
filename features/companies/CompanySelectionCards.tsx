"use client";

import { useRef, useState } from "react";
import type { Company } from "../../lib/api/companies";
import { Button } from "../../components/ui/Button";
import styles from "./selection.module.scss";

export function CompanySelectionCards({ companies }: { companies: Company[] }) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState<string | null>(null);

  return <ul className={styles.grid} aria-label="Empresas disponíveis" aria-busy={pending !== null}>
    {companies.map((company) => <li key={company.id} className={styles.card}>
      <h2>{company.name}</h2>
      <p>Documento: {company.document}</p>
      <form action="/api/companies/active" method="post" onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(company.id);
        // Native document navigation discards router caches and all prior scoped work.
        event.currentTarget.submit();
      }}>
        <input type="hidden" name="companyId" value={company.id} />
        <Button type="submit" loading={pending === company.id} disabled={pending !== null}
          aria-label={`Acessar empresa ${company.name}`}>Acessar empresa</Button>
      </form>
    </li>)}
  </ul>;
}
