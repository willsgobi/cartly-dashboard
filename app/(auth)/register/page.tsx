import { RegisterForm } from "@/features/auth/RegisterForm";
import styles from "../../session.module.scss";

export default function RegisterPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="register-title">
        <h1 id="register-title">Crie sua conta</h1>
        <p>Cadastre seus dados para começar no Venduzily.</p>
        <RegisterForm />
      </section>
    </main>
  );
}
