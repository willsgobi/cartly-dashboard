// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "./RegisterForm";
import { registerAccount } from "./actions";
import type { AuthActionResult } from "./schemas";

const { replace } = vi.hoisted(() => ({ replace: vi.fn<(url: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./actions", () => ({ registerAccount: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.mocked(registerAccount).mockResolvedValue({ ok: true }); });

async function fillForm(user: ReturnType<typeof userEvent.setup>, confirmation = "x") {
  await user.type(screen.getByLabelText(/^Nome completo/), "Pessoa de teste");
  await user.type(screen.getByLabelText(/^E-mail/), "test@example.com");
  await user.type(screen.getByLabelText(/^Senha/), "x");
  await user.type(screen.getByLabelText(/^Confirmar senha/), confirmation);
}

describe("registration form", () => {
  it("shows required errors and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    for (const text of ["Informe seu nome completo.", "Informe seu e-mail.", "Informe sua senha.", "Confirme sua senha."]) {
      expect(await screen.findByText(text)).toBeDefined();
    }
    expect(document.activeElement).toBe(screen.getByLabelText(/^Nome completo/));
    expect(registerAccount).not.toHaveBeenCalled();
    expect(screen.getByRole("form", { name: "Cadastro" }).getAttribute("method")).toBe("post");
  });
  it("rejects invalid email and mismatched passwords", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillForm(user, "different");
    await user.clear(screen.getByLabelText(/^E-mail/));
    await user.type(screen.getByLabelText(/^E-mail/), "invalid");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeDefined();
    expect(screen.getByText("As senhas devem ser iguais.")).toBeDefined();
    expect(registerAccount).not.toHaveBeenCalled();
  });
  it("supports keyboard-friendly password visibility controls without submitting", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    const password = screen.getByLabelText(/^Senha/);
    expect(password.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password.getAttribute("type")).toBe("text");
    expect(screen.getByRole("button", { name: "Ocultar senha" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password.getAttribute("type")).toBe("password");
    expect(registerAccount).not.toHaveBeenCalled();
  });
  it("registers exact fields and navigates without passwords, OTPs or email in the URL", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(registerAccount).toHaveBeenCalledExactlyOnceWith({ name: "Pessoa de teste", email: "test@example.com", password: "x" });
    expect(replace).toHaveBeenCalledWith("/activate-account?registered=1");
    expect(screen.getByLabelText(/^Senha/)).toHaveProperty("value", "");
  });
  it("displays a duplicate email error and permits correction", async () => {
    vi.mocked(registerAccount).mockResolvedValue({ ok: false, status: 409, message: "Este e-mail já está cadastrado." });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Este e-mail já está cadastrado.");
    expect(screen.getByRole("button", { name: "Criar conta" })).toHaveProperty("disabled", false);
    expect(replace).not.toHaveBeenCalled();
  });
  it("shows loading and blocks duplicate submissions", async () => {
    const pending = Promise.withResolvers<AuthActionResult>();
    vi.mocked(registerAccount).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillForm(user);
    const submit = screen.getByRole("button", { name: "Criar conta" });
    await user.dblClick(submit);
    expect(submit).toHaveProperty("disabled", true);
    expect(submit.getAttribute("aria-busy")).toBe("true");
    expect(registerAccount).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve({ ok: true }); });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/activate-account?registered=1"));
  });
  it("handles transport failures without losing user input", async () => {
    vi.mocked(registerAccount).mockRejectedValue(new TypeError("private-network-details"));
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Não foi possível concluir o cadastro. Tente novamente.")).toBeDefined();
    expect(screen.getByLabelText(/^Nome completo/)).toHaveProperty("value", "Pessoa de teste");
    expect(screen.queryByText("private-network-details")).toBeNull();
  });
  it("links to login and direct account activation", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("link", { name: "Já tenho uma conta" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Já recebi um código de ativação" }).getAttribute("href")).toBe("/activate-account");
  });
});
