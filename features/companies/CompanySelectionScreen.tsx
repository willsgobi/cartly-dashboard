import { redirect } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { getDashboardContext } from "./server-context";
import { CompanyWorkspace } from "./CompanyWorkspace";
import { CompanySelectionCards } from "./CompanySelectionCards";
import styles from "./selection.module.scss";

export async function CompanySelectionScreen({ selectionError = false }: { selectionError?: boolean }) {
  const context = await getDashboardContext();
  if (context.kind !== "authenticated") return CompanyWorkspace({});
  if (!context.companies.length) redirect("/dashboard/onboarding");
  if (context.activeCompany && !selectionError) redirect("/dashboard");

  return <main className={styles.page}>
    <section className={styles.content} aria-labelledby="company-selection-title">
      <header className={styles.heading}>
        <h1 id="company-selection-title">Selecione sua empresa</h1>
        <p>Escolha qual empresa deseja gerenciar.</p>
      </header>
      {selectionError && <p role="alert" className={styles.error}>Não foi possível selecionar a empresa. Verifique as empresas disponíveis e tente novamente.</p>}
      <CompanySelectionCards companies={context.companies} />
      <form action="/api/auth/logout" method="post"><Button type="submit" variant="outline">Sair</Button></form>
    </section>
  </main>;
}
