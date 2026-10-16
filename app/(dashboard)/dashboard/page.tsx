import { Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { requireDashboardAccess } from "@/lib/auth/guard";
import styles from "../../session.module.scss";

async function ProtectedDashboard() {
  const access = await requireDashboardAccess();
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {access.kind === "authenticated" ? (
          <><h1>Área protegida</h1><p>Sua sessão está ativa.</p></>
        ) : access.kind === "denied" ? (
          <><h1>Acesso negado</h1><p role="alert">Você não tem permissão para acessar esta área.</p></>
        ) : (
          <><h1>Acesso indisponível</h1><p role="alert">Não foi possível verificar seu acesso. Tente novamente.</p></>
        )}
        <form action="/api/auth/logout" method="post">
          <Button type="submit" variant="outline">Sair</Button>
        </form>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<p role="status">Verificando sessão...</p>}><ProtectedDashboard /></Suspense>;
}
