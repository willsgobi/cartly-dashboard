import { redirect } from "next/navigation";
import { getDashboardContext } from "../companies/server-context";
import { Button } from "../../components/ui/Button";
import { ProductsManager } from "./ProductsManager";

export async function ProductsWorkspace() {
  const context = await getDashboardContext();
  if (context.kind !== "authenticated") return <section><h2>Produtos indisponíveis</h2><p role="alert">{context.kind === "denied" ? "Você não tem permissão para acessar esta área." : "Não foi possível verificar seu acesso. Tente novamente."}</p><a href="/dashboard/products">Tentar novamente</a><form method="post" action="/api/auth/logout"><Button type="submit" variant="outline">Sair</Button></form></section>;
  if (!context.companies.length) redirect("/dashboard/onboarding");
  if (!context.activeCompany) redirect("/select-company");
  return <ProductsManager />;
}
