// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { RecoveryProvider } from "./RecoveryContext";
import { requestPasswordReset, resetPassword } from "./actions";
import { resetPasswordFormSchema, type AuthActionResult } from "./schemas";
import ForgotPasswordPage from "../../app/(auth)/(recovery)/forgot-password/page";
import ResetPasswordPage from "../../app/(auth)/(recovery)/reset-password/page";
import { LoginForm } from "./LoginForm";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./actions", () => ({ requestPasswordReset: vi.fn(), resetPassword: vi.fn() }));
vi.mock("./login", () => ({ login: vi.fn() }));
afterEach(cleanup);
beforeEach(() => {
  vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });
  vi.mocked(resetPassword).mockResolvedValue({ ok: true });
});
const recovery = (reset = false) => render(<RecoveryProvider>{reset ? <ResetPasswordForm /> : <ForgotPasswordForm />}</RecoveryProvider>);
async function fillReset(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^E-mail/), "test@example.com");
  await user.click(screen.getByLabelText(/^Código de verificação/));
  await user.paste("00001234");
  await user.type(screen.getByLabelText(/^Nova senha/), "x");
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), "x");
}

describe("password recovery forms", () => {
  it("validates required/invalid email and focuses the field", async () => {
    const user = userEvent.setup(); recovery();
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("Informe seu e-mail.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(/^E-mail/));
    await user.type(screen.getByLabelText(/^E-mail/), "invalid");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeDefined();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
  it("shows generic success and transfers email in memory between steps", async () => {
    const user = userEvent.setup(); const view = recovery();
    await user.type(screen.getByLabelText(/^E-mail/), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Se o e-mail estiver cadastrado, você receberá um código para redefinir sua senha.");
    expect(screen.getByRole("link", { name: "Continuar para redefinir senha" }).getAttribute("href")).toBe("/reset-password");
    expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith({ email: "test@example.com" });
    view.rerender(<RecoveryProvider><ResetPasswordForm /></RecoveryProvider>);
    expect(screen.getByLabelText(/^E-mail/)).toHaveProperty("value", "test@example.com");
  });
  it.each([false, true])("blocks duplicate requests and shows loading (reset=%s)", async (isReset) => {
    const pending = Promise.withResolvers<AuthActionResult>();
    const action = isReset ? resetPassword : requestPasswordReset;
    vi.mocked(action).mockReturnValue(pending.promise);
    const user = userEvent.setup(); recovery(isReset);
    if (isReset) await fillReset(user); else await user.type(screen.getByLabelText(/^E-mail/), "test@example.com");
    const submit = screen.getByRole("button", { name: isReset ? "Redefinir senha" : "Enviar código" });
    await user.dblClick(submit);
    expect(submit).toHaveProperty("disabled", true);
    expect(submit.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByLabelText(/^E-mail/).closest("fieldset")).toHaveProperty("disabled", true);
    expect(action).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ ok: false, message: "Tente novamente." }));
    await waitFor(() => expect(submit).toHaveProperty("disabled", false));
  });
  it.each([false, true])("preserves values after HTTP and unexpected failures (reset=%s)", async (isReset) => {
    const action = isReset ? resetPassword : requestPasswordReset;
    vi.mocked(action).mockResolvedValueOnce({ ok: false, status: 400, message: "Confira os dados informados." }).mockRejectedValueOnce(new Error("private technical details"));
    const user = userEvent.setup(); recovery(isReset);
    if (isReset) await fillReset(user); else await user.type(screen.getByLabelText(/^E-mail/), "test@example.com");
    const submit = screen.getByRole("button", { name: isReset ? "Redefinir senha" : "Enviar código" });
    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Confira os dados informados.");
    expect(screen.getByLabelText(/^E-mail/)).toHaveProperty("value", "test@example.com");
    if (isReset) {
      expect(screen.getByLabelText(/^Código de verificação/)).toHaveProperty("value", "00001234");
      expect(screen.getByLabelText(/^Nova senha/)).toHaveProperty("value", "x");
    }
    await user.click(submit);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Tente novamente."));
    expect(screen.getByRole("alert").textContent).not.toContain("private");
    expect(replace).not.toHaveBeenCalled();
  });
  it("requires reset fields and matching passwords without invented strength rules", async () => {
    const user = userEvent.setup(); recovery(true);
    expect(screen.getByLabelText(/^E-mail/)).toHaveProperty("value", "");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));
    expect(await screen.findByText("Informe seu e-mail.")).toBeDefined();
    expect(screen.getByText("Informe um código com exatamente 8 dígitos.")).toBeDefined();
    expect(screen.getByText("Informe sua senha.")).toBeDefined();
    expect(screen.getByText("Confirme sua senha.")).toBeDefined();
    await fillReset(user);
    await user.type(screen.getByLabelText(/^Confirmar nova senha/), "different");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));
    expect(await screen.findByText("As senhas devem ser iguais.")).toBeDefined();
    expect(resetPassword).not.toHaveBeenCalled();
  });
  it.each(["1234567", "123456789", "abcd1234"])("rejects OTP format %s in the shared schema", (otp) => {
    expect(resetPasswordFormSchema.safeParse({ email: "test@example.com", otp, password: "x", confirmPassword: "x" }).success).toBe(false);
  });
  it("supports paste, visibility and keyboard submit; clears sensitive fields and redirects after success", async () => {
    const user = userEvent.setup(); recovery(true);
    await fillReset(user);
    expect(screen.getByLabelText(/^Código de verificação/)).toHaveProperty("value", "00001234");
    expect(screen.getByLabelText(/^Código/).getAttribute("inputmode")).toBe("numeric");
    expect(screen.getByRole("form").getAttribute("method")).toBe("post");
    await user.click(screen.getByRole("button", { name: "Mostrar nova senha" }));
    expect(screen.getByLabelText(/^Nova senha/).getAttribute("type")).toBe("text");
    await user.click(screen.getByLabelText(/^Confirmar nova senha/));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?status=password-reset"));
    expect(resetPassword).toHaveBeenCalledExactlyOnceWith({ email: "test@example.com", otp: "00001234", password: "x" });
    expect(screen.getByLabelText(/^Código/)).toHaveProperty("value", "");
    expect(screen.getByLabelText(/^Nova senha/)).toHaveProperty("value", "");
    expect(screen.getByRole("status").textContent).toContain("Senha redefinida com sucesso");
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
  it("provides public pages and recovery/login navigation", () => {
    const view = render(<RecoveryProvider><ForgotPasswordPage /></RecoveryProvider>);
    expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Já tenho um código" }).getAttribute("href")).toBe("/reset-password");
    view.rerender(<RecoveryProvider><ResetPasswordPage /></RecoveryProvider>);
    expect(screen.getByRole("heading", { name: "Redefinir senha" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Solicitar outro código" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByRole("link", { name: "Voltar ao login" }).getAttribute("href")).toBe("/login");
    view.rerender(<LoginForm returnTo="/dashboard" />);
    expect(screen.getByRole("link", { name: "Esqueci minha senha?" }).getAttribute("href")).toBe("/forgot-password");
  });
});
