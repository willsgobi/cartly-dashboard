// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { getDashboardContext } from "../companies/server-context";
import { ApiError } from "../../lib/api/errors";

vi.mock("../companies/server-context", () => ({ getDashboardContext: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("../../components/layout/MobileNavigation", () => ({ MobileNavigation: () => <button>Menu móvel</button> }));
const company = { id: "a", name: "Empresa a", document: "a", createdAt: "now", updatedAt: "now" };
beforeEach(() => {
  vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: [company], activeCompany: company, user: { name: "Pessoa", email: "test@example.com" } });
});
afterEach(cleanup);

describe("authenticated App Router shell", () => {
  it("renders the shared verified context, sidebar, header, skip link and protected page slot", async () => {
    render(await DashboardLayout({ children: <p>Conteúdo da página</p> }));
    expect(screen.getByRole("main").textContent).toContain("Conteúdo da página");
    expect(screen.getByRole("complementary", { name: "Barra lateral" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" }).getAttribute("href")).toBe("#dashboard-content");
    expect(screen.getByRole("status").textContent).toBe("Empresa a");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeDefined();
    expect(screen.getByLabelText("Minha conta").closest("aside")).not.toBeNull();
    expect(screen.getByRole("banner").querySelector("[data-user-menu]")).toBeNull();
  });
  it("supports existing sessions without a stored user name", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: [company], activeCompany: company, user: null });
    render(await DashboardLayout({ children: <p>Página</p> }));
    expect(screen.getByLabelText("Minha conta").textContent).toContain("Minha conta");
  });
  it.each(["denied", "unavailable"] as const)("withholds shell/company/profile data on %s and delegates to the guarded page state", async (kind) => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind, error: new ApiError("http", { status: 403 }) });
    render(await DashboardLayout({ children: <p role="alert">Acesso indisponível</p> }));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByText("Empresa a")).toBeNull();
  });
});
