// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { login } from "./login";
import { ApiError } from "../../lib/api/errors";

vi.mock("./login", () => ({ login: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.mocked(login).mockResolvedValue(); });

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^E-mail/), "test@example.com");
  await user.type(screen.getByLabelText(/^Senha/), "synthetic-password");
}

describe("login form", () => {
  it("validates required fields and focuses email without submitting", async () => {
    const user = userEvent.setup();
    render(<LoginForm returnTo="/dashboard" />);
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Informe seu e-mail.")).toBeDefined();
    expect(screen.getByText("Informe sua senha.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(/^E-mail/));
    expect(screen.getByRole("form").getAttribute("method")).toBe("post");
    expect(login).not.toHaveBeenCalled();
  });
  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm returnTo="/dashboard" />);
    await user.type(screen.getByLabelText(/^E-mail/), "invalid");
    await user.type(screen.getByLabelText(/^Senha/), "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeDefined();
    expect(login).not.toHaveBeenCalled();
  });
  it("logs in with the intended route and clears credentials while navigating", async () => {
    const user = userEvent.setup();
    render(<LoginForm returnTo="/dashboard?tab=summary" />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(login).toHaveBeenCalledExactlyOnceWith({ email: "test@example.com", password: "synthetic-password" }, "/dashboard?tab=summary");
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Login realizado. Abrindo o painel...");
    expect(screen.getByLabelText(/^Senha/)).toHaveProperty("value", "");
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveProperty("disabled", true);
  });
  it("displays invalid credentials without redirecting and permits correction", async () => {
    vi.mocked(login).mockRejectedValue(new ApiError("http", { status: 401 }));
    const user = userEvent.setup();
    render(<LoginForm returnTo="/dashboard" />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "E-mail ou senha inválidos.");
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveProperty("disabled", false);
  });
  it("shows loading and blocks duplicate submissions", async () => {
    const pending = Promise.withResolvers<void>();
    vi.mocked(login).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<LoginForm returnTo="/dashboard" />);
    await fill(user);
    await user.dblClick(screen.getByRole("button", { name: "Entrar" }));
    expect(login).toHaveBeenCalledOnce();
    expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByLabelText(/^Senha/).closest("fieldset")).toHaveProperty("disabled", true);
    await act(async () => { pending.resolve(); });
  });
  it.each([
    [new ApiError("http", { status: 403 }), "Você não tem permissão para realizar esta ação."],
    [new ApiError("network"), "Não foi possível conectar ao servidor. Tente novamente."],
    [new Error("private-detail"), "Não foi possível entrar. Tente novamente."],
  ])("shows a safe error for %s", async (error, message) => {
    vi.mocked(login).mockRejectedValue(error);
    const user = userEvent.setup();
    render(<LoginForm returnTo="/dashboard" />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", message);
    expect(screen.queryByText("private-detail")).toBeNull();
  });
  it("offers password visibility and registration/activation navigation", async () => {
    const user = userEvent.setup();
    render(<LoginForm returnTo="/dashboard" />);
    expect(screen.getByLabelText(/^Senha/).getAttribute("autocomplete")).toBe("current-password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText(/^Senha/).getAttribute("type")).toBe("text");
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Ativar minha conta" }).getAttribute("href")).toBe("/activate-account");
  });
});
