// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActiveCompanyProvider } from "../companies/ActiveCompanyContext";
import { DashboardHeader } from "../../components/layout/DashboardHeader";
import { SidebarNavigation } from "../../components/layout/SidebarNavigation";

const { location } = vi.hoisted(() => ({ location: { pathname: "/dashboard" } }));
vi.mock("next/navigation", () => ({ usePathname: () => location.pathname }));
const companies = ["a", "b"].map((id) => ({ id, name: `Empresa ${id}`, document: id, createdAt: "now", updatedAt: "now" }));
const user = { name: "Pessoa de teste", email: "test@example.com" };
beforeEach(() => {
  location.pathname = "/dashboard";
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  // jsdom does not implement native modal behavior; Chrome checks the actual inert/focus semantics.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { if (this.open) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); } } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function header(single = false) {
  return <ActiveCompanyProvider companies={single ? [companies[0]] : companies} activeCompany={companies[0]}><DashboardHeader user={user} /></ActiveCompanyProvider>;
}

describe("dashboard shell", () => {
  it("provides only real navigation and labels every unavailable module", () => {
    render(<SidebarNavigation />);
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
    for (const label of ["Pedidos", "Produtos", "Categorias", "Clientes", "Usuários", "Relatórios", "Configurações"]) {
      expect(screen.getByText(label).closest("[aria-disabled]")).not.toBeNull();
      expect(screen.queryByRole("link", { name: label })).toBeNull();
    }
    expect(screen.getAllByText("Em breve")).toHaveLength(7);
  });
  it("does not mark Dashboard active on the company creation route", () => {
    location.pathname = "/dashboard/onboarding";
    render(<SidebarNavigation />);
    expect(screen.getByRole("link", { name: "Dashboard" }).hasAttribute("aria-current")).toBe(false);
  });
  it("shows the selected company and reuses the authorized F06 switch form", () => {
    render(header());
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Empresa a");
    expect(screen.getByLabelText("Empresa")).toHaveProperty("value", "a");
    expect(screen.getByLabelText("Empresa").closest("form")?.getAttribute("action")).toBe("/api/companies/active");
  });
  it("renders a single company without a redundant switcher", () => {
    render(header(true));
    expect(screen.getByRole("status").textContent).toBe("Empresa a");
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("opens/closes the mobile drawer, handles Escape and restores trigger focus", async () => {
    const actor = userEvent.setup();
    render(header());
    const trigger = screen.getByRole("button", { name: "Abrir menu de navegação" });
    await actor.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Fechar menu de navegação" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    await actor.click(trigger);
    await actor.click(screen.getByRole("button", { name: "Fechar menu de navegação" }));
    expect(document.activeElement).toBe(trigger);
  });
  it("closes the reused sidebar after selecting an available navigation item", async () => {
    const actor = userEvent.setup();
    render(<div onClickCapture={(event) => event.preventDefault()}>{header()}</div>);
    await actor.click(screen.getByRole("button", { name: "Abrir menu de navegação" }));
    await actor.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Dashboard" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("closes on the backdrop without making background content interactive", async () => {
    render(header());
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir menu de navegação" }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("provides user details and the existing native logout through the account disclosure", async () => {
    render(header());
    await userEvent.setup().click(screen.getByLabelText("Menu da conta"));
    expect(screen.getByText(user.email)).toBeDefined();
    const form = screen.getByRole("button", { name: "Sair" }).closest("form");
    expect(form?.getAttribute("action")).toBe("/api/auth/logout");
    expect(form?.getAttribute("method")).toBe("post");
    fireEvent.keyDown(screen.getByLabelText("Menu da conta"), { key: "Escape" });
    expect(screen.getByLabelText("Menu da conta").closest("details")).toHaveProperty("open", false);
  });
});
