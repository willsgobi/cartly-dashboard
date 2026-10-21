import { redirect } from "next/navigation";
import { Button } from "../../../components/ui/Button";
import { getDashboardContext } from "../server-context";
import { CompanySettingsManager } from "./CompanySettingsManager";

export async function CompanySettingsWorkspace() {
  const context = await getDashboardContext();
  if (context.kind !== "authenticated") return <section><h2>Configurações indisponíveis</h2><p role="alert">{context.kind === "denied" ? "Você não tem permissão para acessar esta área." : "Não foi possível verificar seu acesso. Tente novamente."}</p><a href="/dashboard/settings/company">Tentar novamente</a><form method="post" action="/api/auth/logout"><Button type="submit" variant="outline">Sair</Button></form></section>;
  if (!context.companies.length) redirect("/dashboard/onboarding");
  if (!context.activeCompany) redirect("/select-company");
  return <CompanySettingsManager />;
}
