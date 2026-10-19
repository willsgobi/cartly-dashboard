import { z } from "zod";

export const emailSchema = z.string({ error: "Informe seu e-mail." }).trim()
  .min(1, "Informe seu e-mail.")
  .pipe(z.email({ error: "Informe um e-mail válido." }));

// No password length/complexity rule is defined in the supplied backend contract.
export const registerRequestSchema = z.object({
  name: z.string({ error: "Informe seu nome completo." }).trim().min(1, "Informe seu nome completo."),
  email: emailSchema,
  password: z.string({ error: "Informe sua senha." }).min(1, "Informe sua senha."),
});

export const loginFormSchema = registerRequestSchema.pick({ email: true, password: true });
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = registerRequestSchema.extend({
  confirmPassword: z.string({ error: "Confirme sua senha." }).min(1, "Confirme sua senha."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas devem ser iguais.", path: ["confirmPassword"],
});

export const activationSchema = z.object({
  email: emailSchema,
  otp: z.string({ error: "Informe o código de ativação." })
    .regex(/^[0-9]{8}$/, "Informe um código com exatamente 8 dígitos."),
});

export const resendSchema = z.object({ email: emailSchema });

export const resetPasswordRequestSchema = activationSchema.extend({
  password: registerRequestSchema.shape.password,
});
export const resetPasswordFormSchema = resetPasswordRequestSchema.extend({
  confirmPassword: registerFormSchema.shape.confirmPassword,
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas devem ser iguais.", path: ["confirmPassword"],
});
export type RecoveryEmailValues = z.infer<typeof resendSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type ActivationFormValues = z.infer<typeof activationSchema>;

export type AuthActionResult = { ok: true } | { ok: false; message: string; status?: number };
