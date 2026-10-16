import { Suspense } from "react";
import { CompanyWorkspace } from "../../../../features/companies/CompanyWorkspace";

export default function OnboardingBoundaryPage() {
  return <Suspense fallback={<p role="status">Carregando empresas...</p>}><CompanyWorkspace onboarding /></Suspense>;
}
