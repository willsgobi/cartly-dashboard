import { Suspense } from "react";
import { CompanySelectionScreen } from "@/features/companies/CompanySelectionScreen";

async function SelectionContent({ searchParams }: PageProps<"/select-company">) {
  const { companyError } = await searchParams;
  return <CompanySelectionScreen selectionError={typeof companyError === "string"} />;
}

export default function SelectCompanyPage(props: PageProps<"/select-company">) {
  return <Suspense fallback={<p role="status">Carregando empresas...</p>}><SelectionContent {...props} /></Suspense>;
}
