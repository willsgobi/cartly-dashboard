// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CompanyWorkspace } from "./CompanyWorkspace";
import { requireDashboardAccess } from "../../lib/auth/guard";
import { ApiError } from "../../lib/api/errors";

vi.mock("server-only", () => ({}));
vi.mock("../../lib/auth/guard", () => ({ requireDashboardAccess: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
const companies = ["a", "b"].map((id) => ({ id, name: `Empresa ${id}`, document: id, createdAt: "now", updatedAt: "now" }));
beforeEach(() => { vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies }); });
afterEach(cleanup);

describe("company workspace navigation boundary", () => {
  it("redirects zero companies to the protected onboarding boundary", async () => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies: [] });
    await expect(CompanyWorkspace({})).rejects.toThrow("REDIRECT:/dashboard/onboarding");
  });
  it("shows an empty boundary without implementing the F07 creation form", async () => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies: [] });
    render(await CompanyWorkspace({ onboarding: true }));
    expect(screen.getByRole("heading", { name: "Nenhuma empresa disponível" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Verificar empresas novamente" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Sair" }).closest("form")?.getAttribute("action")).toBe("/api/auth/logout");
  });
  it("redirects users with companies away from onboarding without a loop", async () => {
    await expect(CompanyWorkspace({ onboarding: true })).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("automatically selects one company", async () => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies: [companies[0]] });
    render(await CompanyWorkspace({}));
    expect(screen.getByRole("status").textContent).toBe("Empresa a");
  });
  it("shows a selector when there are multiple companies and a safe selection error", async () => {
    render(await CompanyWorkspace({ selectionError: true }));
    expect(screen.getByRole("combobox")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível selecionar");
  });
  it.each(["denied", "unavailable"] as const)("withholds company data on %s", async (kind) => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind, error: new ApiError("network") });
    render(await CompanyWorkspace({}));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Empresa a")).toBeNull();
  });
});
