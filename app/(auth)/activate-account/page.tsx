import { Suspense } from "react";
import { ActivationForm } from "@/features/auth/ActivationForm";
import styles from "../../session.module.scss";

async function ActivationContent({ searchParams }: PageProps<"/activate-account">) {
  const { registered } = await searchParams;
  return <ActivationForm registrationSucceeded={registered === "1"} />;
}

export default function ActivateAccountPage(props: PageProps<"/activate-account">) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="activation-title">
        <h1 id="activation-title">Ative sua conta</h1>
        <p>Informe seu e-mail e o código de ativação recebido.</p>
        <Suspense fallback={<p role="status">Carregando formulário...</p>}>
          <ActivationContent {...props} />
        </Suspense>
      </section>
    </main>
  );
}
