// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProductsWorkspace } from "./ProductsWorkspace";
import { getDashboardContext } from "../companies/server-context";
import { ApiError } from "../../lib/api/errors";
import { company } from "./test-fixtures";
vi.mock("../companies/server-context", () => ({ getDashboardContext: vi.fn() }));
vi.mock("./ProductsManager", () => ({ ProductsManager: () => <p>Catálogo de produtos</p> }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
afterEach(cleanup);
describe("protected product rendering", () => {
  it("uses the authoritative company context at the page boundary", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: [company], activeCompany: company, user: null }); render(await ProductsWorkspace()); expect(screen.getByText("Catálogo de produtos")).toBeDefined(); expect(getDashboardContext).toHaveBeenCalledOnce();
  });
  it("reuses onboarding when no companies exist", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: [], activeCompany: null, user: null }); await expect(ProductsWorkspace()).rejects.toThrow("REDIRECT:/dashboard/onboarding");
  });
  it("withholds product management until a valid company is selected", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: [company, { ...company, id: "other" }], activeCompany: null, user: null });
    await expect(ProductsWorkspace()).rejects.toThrow("REDIRECT:/select-company");
    expect(screen.queryByText("Catálogo de produtos")).toBeNull();
  });
  it.each(["denied", "unavailable"] as const)("withholds product controls for %s", async (kind) => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind, error: new ApiError("http", { status: 403 }) }); render(await ProductsWorkspace()); expect(screen.getByRole("alert")).toBeDefined(); expect(screen.queryByText("Catálogo de produtos")).toBeNull();
  });
});
