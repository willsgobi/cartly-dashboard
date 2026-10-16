"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { activateAccount, resendActivation } from "./actions";
import { activationSchema, type ActivationFormValues } from "./schemas";
import styles from "./forms.module.scss";

export function ActivationForm({ registrationSucceeded = false }: { registrationSucceeded?: boolean }) {
  const router = useRouter();
  const otpHintId = useId();
  const inFlight = useRef(false);
  const [resending, setResending] = useState(false);
  const [activated, setActivated] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const { register, handleSubmit, trigger, getValues, reset, formState: { errors, isSubmitting } } = useForm<ActivationFormValues>({
    resolver: zodResolver(activationSchema), defaultValues: { email: "", otp: "" },
  });
  const busy = isSubmitting || resending || activated;

  async function submit(values: ActivationFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    try {
      const result = await activateAccount(values);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.message });
        return;
      }
      reset();
      setActivated(true);
      setFeedback({ kind: "success", message: "Conta ativada com sucesso. Você já pode entrar." });
      router.replace("/login?status=activated");
    } catch {
      setActivated(false);
      setFeedback({ kind: "error", message: "Não foi possível ativar sua conta. Tente novamente." });
    } finally {
      inFlight.current = false;
    }
  }

  async function resend() {
    if (inFlight.current) return;
    inFlight.current = true;
    setResending(true);
    setFeedback(null);
    try {
      if (!await trigger("email", { shouldFocus: true })) return;
      const result = await resendActivation({ email: getValues("email") });
      setFeedback(result.ok
        ? { kind: "success", message: "Se houver uma conta aguardando ativação para este e-mail, enviaremos um novo código." }
        : { kind: "error", message: result.message });
    } catch {
      setFeedback({ kind: "error", message: "Não foi possível reenviar o código. Tente novamente." });
    } finally {
      inFlight.current = false;
      setResending(false);
    }
  }

  return (
    <form method="post" aria-label="Ativação de conta" className={styles.form} onSubmit={(event) => { void handleSubmit(submit)(event); }} noValidate aria-busy={busy}>
      {registrationSucceeded && <p role="status" className={styles.success}>Cadastro realizado. Confira seu e-mail para obter o código de ativação.</p>}
      <fieldset className={styles.fields} disabled={busy}>
        <legend className={styles.legend}>Dados de ativação</legend>
        <Input label="E-mail cadastrado" type="email" autoComplete="email" required error={errors.email?.message} {...register("email")} />
        <Input label="Código de ativação" type="text" inputMode="numeric" autoComplete="one-time-code"
          maxLength={8} pattern="[0-9]{8}" required aria-describedby={otpHintId} error={errors.otp?.message} {...register("otp")} />
        <p id={otpHintId} className={styles.hint}>Digite ou cole os 8 dígitos do código recebido por e-mail.</p>
      </fieldset>
      {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={styles[feedback.kind]}>{feedback.message}</p>}
      <Button type="submit" loading={isSubmitting} disabled={busy}>Ativar conta</Button>
      <Button variant="outline" onClick={resend} loading={resending} disabled={busy}>Reenviar código de ativação</Button>
      <nav aria-label="Navegação de ativação" className={styles.navigation}>
        <Link href="/login">Voltar para entrar</Link>
      </nav>
    </form>
  );
}
