import Link from "next/link";
import { Suspense } from "react";
import styles from "../../session.module.scss";

async function LoginStatus({ searchParams }: PageProps<"/login">) {
  const { reason, status } = await searchParams;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Acesse sua conta</h1>
        {reason === "expired" && <p role="status">Sua sessão expirou. Entre novamente para continuar.</p>}
        {status === "activated" && <p role="status">Conta ativada com sucesso. Você já pode entrar.</p>}
        <p>Entre na sua conta para acessar o painel administrativo.</p>
        <Link href="/register">Criar conta</Link>
        <Link href="/">Voltar ao início</Link>
      </section>
    </main>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return <Suspense fallback={<p role="status">Carregando...</p>}><LoginStatus {...props} /></Suspense>;
}
