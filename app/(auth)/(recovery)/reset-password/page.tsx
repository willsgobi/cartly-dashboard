import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";
import styles from "../../../session.module.scss";

export default function ResetPasswordPage() {
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="reset-title">
      <h1 id="reset-title">Redefinir senha</h1>
      <p>Informe seu e-mail, o código recebido e sua nova senha.</p>
      <ResetPasswordForm />
    </section>
  </main>;
}
