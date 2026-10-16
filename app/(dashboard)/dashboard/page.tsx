import { Suspense } from "react";
import { CompanyWorkspace } from "../../../features/companies/CompanyWorkspace";

async function DashboardContent({ searchParams }: PageProps<"/dashboard">) {
  const { companyError } = await searchParams;
  return <CompanyWorkspace selectionError={typeof companyError === "string"} />;
}

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return <Suspense fallback={<p role="status">Carregando empresas...</p>}><DashboardContent {...props} /></Suspense>;
}
