import { redirect } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { getDashboardContext } from "./server-context";
import { CompanyOnboardingForm } from "./onboarding/CompanyOnboardingForm";
import styles from "../../app/session.module.scss";
import dashboardStyles from "../../components/layout/dashboard.module.scss";

export async function CompanyWorkspace({ onboarding = false, selectionError = false }: { onboarding?: boolean; selectionError?: boolean }) {
  const access = await getDashboardContext();
  if (access.kind === "authenticated") {
    if (!access.companies.length && !onboarding) redirect("/dashboard/onboarding");
    if (!access.activeCompany && !onboarding) redirect("/select-company");
  }
  if (access.kind === "authenticated") {
    if (onboarding) return <section className={`${dashboardStyles.card} ${dashboardStyles.onboarding}`}>
      <h2>Cadastre sua empresa</h2><CompanyOnboardingForm /><a href="/dashboard">{access.companies.length ? "Voltar ao dashboard" : "Verificar empresas novamente"}</a>
    </section>;
    return <section className={dashboardStyles.card} aria-label="Visão geral do dashboard">
      <h2>{access.user?.name ? `Olá, ${access.user.name}!` : "Boas-vindas ao Cartly!"}</h2>
      <p>Organize a gestão do seu negócio por aqui.</p>
      {selectionError && <p role="alert" className={dashboardStyles.error}>Não foi possível selecionar a empresa. Verifique as empresas disponíveis e tente novamente.</p>}
      <div className={dashboardStyles.empty}>
        <h3>{access.activeCompany ? access.activeCompany.name : "Escolha sua empresa para começar"}</h3>
        <p>{access.activeCompany ? "Este é o espaço da sua empresa. Os módulos de gestão estarão disponíveis em breve." : "Selecione uma das empresas disponíveis no cabeçalho para definir seu contexto de trabalho."}</p>
        <a href="/dashboard/onboarding">Criar nova empresa</a>
      </div>
    </section>;
  }
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {access.kind === "denied" ? (
          <><h1>Acesso negado</h1><p role="alert">Você não tem permissão para acessar esta área.</p></>
        ) : (
          <><h1>Acesso indisponível</h1><p role="alert">Não foi possível verificar seu acesso. Tente novamente.</p><a href="/dashboard">Tentar novamente</a></>
        )}
        <form action="/api/auth/logout" method="post"><Button type="submit" variant="outline">Sair</Button></form>
      </section>
    </main>
  );
}
