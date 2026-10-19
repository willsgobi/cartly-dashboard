import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";
import styles from "../../../session.module.scss";

export default function ForgotPasswordPage() {
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="forgot-title">
      <h1 id="forgot-title">Recuperar senha</h1>
      <p>Informe seu e-mail para solicitar um código de verificação.</p>
      <ForgotPasswordForm />
    </section>
  </main>;
}
