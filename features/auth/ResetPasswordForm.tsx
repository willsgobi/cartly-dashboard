"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Button } from "../../components/ui/Button";
import { resetPassword } from "./actions";
import { useRecoveryEmail } from "./RecoveryContext";
import { resetPasswordFormSchema, type ResetPasswordFormValues } from "./schemas";
import styles from "./forms.module.scss";

export function ResetPasswordForm() {
  const router = useRouter();
  const { email, setEmail } = useRecoveryEmail();
  const hintId = useId();
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { email, otp: "", password: "", confirmPassword: "" },
  });
  const busy = isSubmitting || feedback?.kind === "success";

  async function submit(values: ResetPasswordFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    try {
      const result = await resetPassword({ email: values.email, otp: values.otp, password: values.password });
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.message });
        return;
      }
      reset({ email: "", otp: "", password: "", confirmPassword: "" });
      setEmail("");
      setFeedback({ kind: "success", message: "Senha redefinida com sucesso. Entre com sua nova senha." });
      router.replace("/login?status=password-reset");
    } catch {
      setFeedback({ kind: "error", message: "Não foi possível redefinir sua senha. Tente novamente." });
    } finally {
      inFlight.current = false;
    }
  }

  return <form method="post" aria-label="Redefinição de senha" className={styles.form}
    onSubmit={(event) => { void handleSubmit(submit)(event); }} noValidate aria-busy={busy}>
    <fieldset className={styles.fields} disabled={busy}>
      <legend className={styles.legend}>Dados para redefinir a senha</legend>
      <Input label="E-mail" type="email" autoComplete="email" required error={errors.email?.message} {...register("email")} />
      <Input label="Código de verificação" type="text" inputMode="numeric" autoComplete="one-time-code"
        maxLength={8} pattern="[0-9]{8}" required aria-describedby={hintId} error={errors.otp?.message} {...register("otp")} />
      <p id={hintId} className={styles.hint}>Digite ou cole os 8 dígitos do código recebido por e-mail.</p>
      <PasswordInput label="Nova senha" autoComplete="new-password" required error={errors.password?.message} {...register("password")} />
      <PasswordInput label="Confirmar nova senha" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register("confirmPassword")} />
    </fieldset>
    {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={styles[feedback.kind]}>{feedback.message}</p>}
    <Button type="submit" loading={isSubmitting} disabled={busy}>Redefinir senha</Button>
    <nav aria-label="Navegação de redefinição" className={styles.navigation}>
      <Link href="/forgot-password">Solicitar outro código</Link>
      <Link href="/login">Voltar ao login</Link>
    </nav>
  </form>;
}
