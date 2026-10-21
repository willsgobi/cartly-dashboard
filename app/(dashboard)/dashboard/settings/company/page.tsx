import { Suspense } from "react";
import { CompanySettingsWorkspace } from "@/features/companies/settings/CompanySettingsWorkspace";

export default function CompanySettingsPage() {
  return <Suspense fallback={<p role="status">Carregando configurações...</p>}><CompanySettingsWorkspace /></Suspense>;
}
