"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Button } from "../../components/ui/Button";
import { ApiError } from "../../lib/api/errors";
import { login } from "./login";
import { loginFormSchema, type LoginFormValues } from "./schemas";
import styles from "./forms.module.scss";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });
  const busy = isSubmitting || feedback?.kind === "success";

  async function submit(values: LoginFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    try {
      await login(values, returnTo);
      reset();
      setFeedback({ kind: "success", message: "Login realizado. Abrindo o painel..." });
    } catch (error) {
      const message = error instanceof ApiError
        ? error.status === 401 ? "E-mail ou senha inválidos." : error.message
        : "Não foi possível entrar. Tente novamente.";
      setFeedback({ kind: "error", message });
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <form method="post" aria-label="Login" className={styles.form} onSubmit={(event) => { void handleSubmit(submit)(event); }} noValidate aria-busy={busy}>
      <fieldset className={styles.fields} disabled={busy}>
        <legend className={styles.legend}>Dados de acesso</legend>
        <Input label="E-mail" type="email" autoComplete="username" required error={errors.email?.message} {...register("email")} />
        <PasswordInput label="Senha" autoComplete="current-password" required error={errors.password?.message} {...register("password")} />
      </fieldset>
      {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={styles[feedback.kind]}>{feedback.message}</p>}
      <Button type="submit" loading={isSubmitting} disabled={busy}>Entrar</Button>
      <nav aria-label="Navegação de acesso" className={styles.navigation}>
        <Link href="/register">Criar conta</Link>
        <Link href="/activate-account">Ativar minha conta</Link>
        <Link href="/">Voltar ao início</Link>
      </nav>
    </form>
  );
}
