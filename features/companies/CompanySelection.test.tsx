// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextResponse } from "next/server";
import { CompanySelectionScreen } from "./CompanySelectionScreen";
import { CompanySelectionCards } from "./CompanySelectionCards";
import { requireDashboardAccess } from "../../lib/auth/guard";
import { companyCookieName, setCompanySelection } from "../../lib/companies/selection";
import { sessionCookieName } from "../../lib/auth/session";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { ApiError } from "../../lib/api/errors";

const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn<(name: string) => { value: string } | undefined>() }));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/auth/guard", () => ({ requireDashboardAccess: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, usePathname: () => "/dashboard" }));
const companies = ["a", "b"].map((id) => ({ id, name: `Empresa ${id}`, document: `document-${id}`, createdAt: "now", updatedAt: "now" }));
const token = "session-a";
function saved(companyId: string, session = token) {
  const response = NextResponse.json({});
  setCompanySelection(response, session, companyId);
  const value = response.cookies.get(companyCookieName())?.value;
  getCookie.mockImplementation((name) => name === sessionCookieName() ? { value: token } : name === companyCookieName() && value ? { value } : undefined);
}
beforeEach(() => {
  getCookie.mockImplementation((name) => name === sessionCookieName() ? { value: token } : undefined);
  vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies });
});
afterEach(cleanup);

describe("dedicated protected company selection", () => {
  it("redirects an empty list to existing onboarding", async () => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies: [] });
    await expect(CompanySelectionScreen({})).rejects.toThrow("REDIRECT:/dashboard/onboarding");
  });
  it("automatically activates a single company and redirects to dashboard", async () => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies: [companies[0]] });
    await expect(CompanySelectionScreen({})).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("shows names/documents, selection and logout before the dashboard on first login", async () => {
    render(await CompanySelectionScreen({}));
    expect(screen.getByRole("heading", { name: "Selecione sua empresa" })).toBeDefined();
    expect(screen.getByText("Escolha qual empresa deseja gerenciar.")).toBeDefined();
    for (const company of companies) {
      expect(screen.getByRole("heading", { name: company.name })).toBeDefined();
      expect(screen.getByText(`Documento: ${company.document}`)).toBeDefined();
    }
    expect(screen.getByRole("button", { name: "Sair" }).closest("form")?.getAttribute("action")).toBe("/api/auth/logout");
  });
  it("restores only an authorized selection from the same session", async () => {
    saved("b");
    await expect(CompanySelectionScreen({})).rejects.toThrow("REDIRECT:/dashboard");
  });
  it.each(["removed", "foreign-session", "malformed"])("requires selection for %s preference", async (kind) => {
    if (kind === "removed") saved("removed");
    if (kind === "foreign-session") saved("a", "another-user-session");
    if (kind === "malformed") getCookie.mockImplementation((name) => ({ value: name === sessionCookieName() ? token : "invalid-json" }));
    render(await CompanySelectionScreen({}));
    expect(screen.getAllByRole("button", { name: /^Acessar empresa/ })).toHaveLength(2);
  });
  it("shows a failed-selection retry without redirect loops even with an older valid selection", async () => {
    saved("a");
    render(await CompanySelectionScreen({ selectionError: true }));
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível selecionar");
    expect(screen.getByRole("button", { name: "Acessar empresa Empresa b" })).toBeDefined();
  });
  it.each(["denied", "unavailable"] as const)("withholds company cards on %s and retains logout/retry", async (kind) => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind, error: new ApiError("network") });
    render(await CompanySelectionScreen({}));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText("Empresa a")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("button", { name: "Sair" })).toBeDefined();
    if (kind === "unavailable") expect(screen.getByRole("link", { name: "Tentar novamente" })).toBeDefined();
  });
  it("reuses the authoritative guard for invalid-session redirects", async () => {
    vi.mocked(requireDashboardAccess).mockRejectedValue(new Error("REDIRECT:/login?reason=expired"));
    await expect(CompanySelectionScreen({})).rejects.toThrow("REDIRECT:/login?reason=expired");
  });
  it("withholds the dashboard shell while a selection is missing", async () => {
    render(await DashboardLayout({ children: <p>Protected page boundary</p> }));
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("uses keyboard-friendly native POSTs, existing persistence endpoint and duplicate protection", async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<CompanySelectionCards companies={companies} />);
    const first = screen.getByRole("button", { name: "Acessar empresa Empresa a" });
    await user.tab(); expect(document.activeElement).toBe(first);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Acessar empresa Empresa b" }));
    await user.keyboard("{Enter}");
    expect(submit).toHaveBeenCalledOnce();
    const form = screen.getByRole("button", { name: /Acessar empresa Empresa b/ }).closest("form");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/companies/active");
    expect(form && new FormData(form).get("companyId")).toBe("b");
    for (const button of screen.getAllByRole("button")) expect(button).toHaveProperty("disabled", true);
    await user.click(first); expect(submit).toHaveBeenCalledOnce();
    expect(screen.getByRole("list").getAttribute("aria-busy")).toBe("true");
  });
});
