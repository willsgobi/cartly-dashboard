import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { requireDashboardAccess } from "../../lib/auth/guard";
import { sessionCookieName } from "../../lib/auth/session";
import { companyCookieName, resolveActiveCompany } from "../../lib/companies/selection";
import { ActiveCompanyProvider } from "./ActiveCompanyContext";
import { CompanySelector } from "./CompanySelector";
import styles from "../../app/session.module.scss";
import companyStyles from "./companies.module.scss";

export async function CompanyWorkspace({ onboarding = false, selectionError = false }: { onboarding?: boolean; selectionError?: boolean }) {
  const access = await requireDashboardAccess();
  if (access.kind === "authenticated") {
    if (!access.companies.length && !onboarding) redirect("/dashboard/onboarding");
    if (access.companies.length && onboarding) redirect("/dashboard");
  }
  const store = await cookies();
  const activeCompany = access.kind === "authenticated"
    ? resolveActiveCompany(access.companies, store.get(sessionCookieName())?.value ?? "", store.get(companyCookieName())?.value)
    : null;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {access.kind === "authenticated" ? onboarding ? (
          <><h1>Nenhuma empresa disponível</h1><p>Sua conta ainda não tem empresas disponíveis. O cadastro de empresas estará disponível em breve.</p><Link href="/dashboard">Verificar empresas novamente</Link></>
        ) : (
          <><h1>Área protegida</h1><p>Sua sessão está ativa.</p>
            {selectionError && <p role="alert" className={companyStyles.error}>Não foi possível selecionar a empresa. Verifique as empresas disponíveis e tente novamente.</p>}
            <ActiveCompanyProvider companies={access.companies} activeCompany={activeCompany}><CompanySelector /></ActiveCompanyProvider>
          </>
        ) : access.kind === "denied" ? (
          <><h1>Acesso negado</h1><p role="alert">Você não tem permissão para acessar esta área.</p></>
        ) : (
          <><h1>Acesso indisponível</h1><p role="alert">Não foi possível verificar seu acesso. Tente novamente.</p><Link href="/dashboard">Tentar novamente</Link></>
        )}
        <form action="/api/auth/logout" method="post"><Button type="submit" variant="outline">Sair</Button></form>
      </section>
    </main>
  );
}
