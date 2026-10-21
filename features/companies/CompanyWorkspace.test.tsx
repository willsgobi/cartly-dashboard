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
  it("shows the F07 onboarding form for users without companies", async () => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies: [] });
    render(await CompanyWorkspace({ onboarding: true }));
    expect(screen.getByRole("heading", { name: "Cadastre sua empresa" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Verificar empresas novamente" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("form", { name: "Cadastro de empresa" })).toBeDefined();
  });
  it("reuses onboarding for an additional company and offers a return to the dashboard", async () => {
    render(await CompanyWorkspace({ onboarding: true }));
    expect(screen.getByRole("form", { name: "Cadastro de empresa" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Voltar ao dashboard" }).getAttribute("href")).toBe("/dashboard");
  });
  it("automatically selects one company", async () => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind: "authenticated", companies: [companies[0]] });
    render(await CompanyWorkspace({}));
    expect(screen.getByRole("heading", { name: "Empresa a" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Criar nova empresa" }).getAttribute("href")).toBe("/dashboard/onboarding");
  });
  it("requires a dedicated selection before rendering a multi-company dashboard", async () => {
    await expect(CompanyWorkspace({})).rejects.toThrow("REDIRECT:/select-company");
  });
  it.each(["denied", "unavailable"] as const)("withholds company data on %s", async (kind) => {
    vi.mocked(requireDashboardAccess).mockResolvedValue({ kind, error: new ApiError("network") });
    render(await CompanyWorkspace({}));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("link", { name: "Criar nova empresa" })).toBeNull();
    expect(screen.queryByText("Empresa a")).toBeNull();
  });
});
