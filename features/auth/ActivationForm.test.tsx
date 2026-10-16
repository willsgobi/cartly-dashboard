// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivationForm } from "./ActivationForm";
import { activateAccount, resendActivation } from "./actions";
import type { AuthActionResult } from "./schemas";

const { replace } = vi.hoisted(() => ({ replace: vi.fn<(url: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./actions", () => ({ activateAccount: vi.fn(), resendActivation: vi.fn() }));
afterEach(cleanup);
beforeEach(() => {
  vi.mocked(activateAccount).mockResolvedValue({ ok: true });
  vi.mocked(resendActivation).mockResolvedValue({ ok: true });
});

describe("account activation form", () => {
  it("supports opening directly, requires email and rejects invalid OTP format", async () => {
    const user = userEvent.setup();
    render(<ActivationForm />);
    expect(screen.getByLabelText(/^E-mail cadastrado/)).toHaveProperty("value", "");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));
    expect(await screen.findByText("Informe seu e-mail.")).toBeDefined();
    expect(screen.getByText("Informe um código com exatamente 8 dígitos.")).toBeDefined();
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    await user.type(screen.getByLabelText(/^Código de ativação/), "12ab5678");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));
    expect(activateAccount).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Código/).getAttribute("type")).toBe("text");
    expect(screen.getByLabelText(/^Código/).getAttribute("inputmode")).toBe("numeric");
    expect(screen.getByRole("form").getAttribute("method")).toBe("post");
  });
  it("pastes a complete OTP with leading zeros and navigates to the login success message", async () => {
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    await user.click(screen.getByLabelText(/^Código de ativação/));
    await user.paste("00001234");
    expect(screen.getByLabelText(/^Código de ativação/)).toHaveProperty("value", "00001234");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));
    expect(activateAccount).toHaveBeenCalledExactlyOnceWith({ email: "test@example.com", otp: "00001234" });
    expect(replace).toHaveBeenCalledWith("/login?status=activated");
    expect(screen.getByRole("status").textContent).toContain("Conta ativada com sucesso");
  });
  it("shows invalid/expired OTP errors without navigating", async () => {
    vi.mocked(activateAccount).mockResolvedValue({ ok: false, status: 400, message: "Código inválido ou expirado." });
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    await user.type(screen.getByLabelText(/^Código de ativação/), "00001234");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Código inválido ou expirado.");
    expect(replace).not.toHaveBeenCalled();
  });
  it("resends with only the email, without requiring an OTP or inventing a cooldown", async () => {
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    const resend = screen.getByRole("button", { name: "Reenviar código de ativação" });
    await user.click(resend);
    expect(resendActivation).toHaveBeenCalledExactlyOnceWith({ email: "test@example.com" });
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Se houver uma conta aguardando ativação para este e-mail, enviaremos um novo código.");
    expect(resend).toHaveProperty("disabled", false);
    expect(activateAccount).not.toHaveBeenCalled();
  });
  it("validates the email before resending", async () => {
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "invalid");
    await user.click(screen.getByRole("button", { name: "Reenviar código de ativação" }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeDefined();
    expect(resendActivation).not.toHaveBeenCalled();
  });
  it("blocks resend and activation while a request is pending", async () => {
    const pending = Promise.withResolvers<AuthActionResult>();
    vi.mocked(resendActivation).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    const resend = screen.getByRole("button", { name: "Reenviar código de ativação" });
    await user.dblClick(resend);
    expect(resend).toHaveProperty("disabled", true);
    expect(resend.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Ativar conta" })).toHaveProperty("disabled", true);
    expect(resendActivation).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve({ ok: true }); });
    await waitFor(() => expect(resend).toHaveProperty("disabled", false));
  });
  it("displays resend errors and allows another attempt", async () => {
    vi.mocked(resendActivation).mockResolvedValue({ ok: false, message: "Não foi possível reenviar o código." });
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Reenviar código de ativação" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Não foi possível reenviar o código.");
    expect(screen.getByRole("button", { name: "Reenviar código de ativação" })).toHaveProperty("disabled", false);
  });
  it("shows activation loading and prevents duplicate activation or resend", async () => {
    const pending = Promise.withResolvers<AuthActionResult>();
    vi.mocked(activateAccount).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    await user.type(screen.getByLabelText(/^Código de ativação/), "00001234");
    const submit = screen.getByRole("button", { name: "Ativar conta" });
    await user.dblClick(submit);
    expect(submit).toHaveProperty("disabled", true);
    expect(submit.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Reenviar código de ativação" })).toHaveProperty("disabled", true);
    expect(activateAccount).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve({ ok: true }); });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?status=activated"));
  });
  it("handles unexpected activation transport failures safely", async () => {
    vi.mocked(activateAccount).mockRejectedValue(new TypeError("private-network-details"));
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    await user.type(screen.getByLabelText(/^Código de ativação/), "00001234");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));
    expect(await screen.findByText("Não foi possível ativar sua conta. Tente novamente.")).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });
  it("handles unexpected resend transport failures safely", async () => {
    vi.mocked(resendActivation).mockRejectedValue(new TypeError("private-network-details"));
    const user = userEvent.setup();
    render(<ActivationForm />);
    await user.type(screen.getByLabelText(/^E-mail cadastrado/), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Reenviar código de ativação" }));
    expect(await screen.findByText("Não foi possível reenviar o código. Tente novamente.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Reenviar código de ativação" })).toHaveProperty("disabled", false);
  });
  it("announces registration success and provides navigation back to login", () => {
    render(<ActivationForm registrationSucceeded />);
    expect(screen.getByRole("status").textContent).toContain("Cadastro realizado");
    expect(screen.getByRole("link", { name: "Voltar para entrar" }).getAttribute("href")).toBe("/login");
  });
});
