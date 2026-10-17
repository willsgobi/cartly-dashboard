// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CategoriesWorkspace } from "./CategoriesWorkspace";
import { getDashboardContext } from "../companies/server-context";
import { ApiError } from "../../lib/api/errors";
vi.mock("../companies/server-context", () => ({ getDashboardContext: vi.fn() }));
vi.mock("./CategoriesManager", () => ({ CategoriesManager: () => <p>Gestão de categorias</p> }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
const company = { id: "a", name: "A", document: "a", createdAt: "now", updatedAt: "now" };
afterEach(cleanup);
describe("categories protected server boundary", () => {
  it("reuses the authoritative company context before rendering management", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: [company], activeCompany: company, user: null });
    render(await CategoriesWorkspace()); expect(screen.getByText("Gestão de categorias")).toBeDefined(); expect(getDashboardContext).toHaveBeenCalledOnce();
  });
  it("redirects accounts without companies to existing onboarding", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: [], activeCompany: null, user: null });
    await expect(CategoriesWorkspace()).rejects.toThrow("REDIRECT:/dashboard/onboarding");
  });
  it.each(["denied", "unavailable"] as const)("withholds category controls on %s", async (kind) => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind, error: new ApiError("http", { status: 403 }) });
    render(await CategoriesWorkspace()); expect(screen.getByRole("alert")).toBeDefined(); expect(screen.queryByText("Gestão de categorias")).toBeNull(); expect(screen.getByRole("button", { name: "Sair" })).toBeDefined();
  });
});
