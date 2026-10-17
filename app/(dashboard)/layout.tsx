import { Suspense, type ReactNode } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p role="status">Carregando painel...</p>}><DashboardLayout>{children}</DashboardLayout></Suspense>;
}
