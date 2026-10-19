"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { requestPasswordReset } from "./actions";
import { useRecoveryEmail } from "./RecoveryContext";
import { resendSchema, type RecoveryEmailValues } from "./schemas";
import styles from "./forms.module.scss";

export function ForgotPasswordForm() {
  const { email, setEmail } = useRecoveryEmail();
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RecoveryEmailValues>({
    resolver: zodResolver(resendSchema), defaultValues: { email },
  });

  async function submit(values: RecoveryEmailValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    try {
      const result = await requestPasswordReset(values);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.message });
        return;
      }
      setEmail(values.email);
      setFeedback({ kind: "success", message: "Se o e-mail estiver cadastrado, você receberá um código para redefinir sua senha." });
    } catch {
      setFeedback({ kind: "error", message: "Não foi possível enviar o código. Tente novamente." });
    } finally {
      inFlight.current = false;
    }
  }

  return <form method="post" aria-label="Recuperação de senha" className={styles.form}
    onSubmit={(event) => { void handleSubmit(submit)(event); }} noValidate aria-busy={isSubmitting}>
    <fieldset className={styles.fields} disabled={isSubmitting}>
      <legend className={styles.legend}>E-mail de recuperação</legend>
      <Input label="E-mail" type="email" autoComplete="email" required error={errors.email?.message} {...register("email")} />
    </fieldset>
    {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={styles[feedback.kind]}>{feedback.message}</p>}
    <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>Enviar código</Button>
    <nav aria-label="Navegação de recuperação" className={styles.navigation}>
      <Link href="/reset-password">{feedback?.kind === "success" ? "Continuar para redefinir senha" : "Já tenho um código"}</Link>
      <Link href="/login">Voltar ao login</Link>
    </nav>
  </form>;
}
