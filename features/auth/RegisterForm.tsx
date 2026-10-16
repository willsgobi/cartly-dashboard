"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Button } from "../../components/ui/Button";
import { registerAccount } from "./actions";
import { registerFormSchema, type RegisterFormValues } from "./schemas";
import styles from "./forms.module.scss";

export function RegisterForm() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const busy = isSubmitting || feedback?.kind === "success";

  async function submit(values: RegisterFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    try {
      const result = await registerAccount({ name: values.name, email: values.email, password: values.password });
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.message });
        return;
      }
      reset();
      setFeedback({ kind: "success", message: "Cadastro realizado. Vamos ativar sua conta." });
      router.replace("/activate-account?registered=1");
    } catch {
      setFeedback({ kind: "error", message: "Não foi possível concluir o cadastro. Tente novamente." });
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <form method="post" aria-label="Cadastro" className={styles.form} onSubmit={(event) => { void handleSubmit(submit)(event); }} noValidate aria-busy={busy}>
      <fieldset className={styles.fields} disabled={busy}>
        <legend className={styles.legend}>Dados de cadastro</legend>
        <Input label="Nome completo" autoComplete="name" required error={errors.name?.message} {...register("name")} />
        <Input label="E-mail" type="email" autoComplete="email" required error={errors.email?.message} {...register("email")} />
        <PasswordInput label="Senha" autoComplete="new-password" required error={errors.password?.message} {...register("password")} />
        <PasswordInput label="Confirmar senha" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register("confirmPassword")} />
      </fieldset>
      {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={styles[feedback.kind]}>{feedback.message}</p>}
      <Button type="submit" loading={isSubmitting} disabled={busy}>Criar conta</Button>
      <nav aria-label="Navegação de cadastro" className={styles.navigation}>
        <Link href="/login">Já tenho uma conta</Link>
        <Link href="/activate-account">Já recebi um código de ativação</Link>
      </nav>
    </form>
  );
}
