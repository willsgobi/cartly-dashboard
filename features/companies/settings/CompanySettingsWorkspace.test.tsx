// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CompanySettingsWorkspace } from "./CompanySettingsWorkspace";
import { getDashboardContext } from "../server-context";
import { ApiError } from "../../../lib/api/errors";
import { companies } from "./test-fixtures";
vi.mock("../server-context", () => ({ getDashboardContext: vi.fn() }));
vi.mock("./CompanySettingsManager", () => ({ CompanySettingsManager: () => <p>Company settings manager</p> }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
afterEach(cleanup);
describe("company settings protected page", () => {
  it("requires the authoritative active company before rendering management", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies, activeCompany: companies[0], user: null });
    render(await CompanySettingsWorkspace()); expect(screen.getByText("Company settings manager")).toBeDefined();
  });
  it.each([false, true])("redirects zero/unselected companies (empty=%s)", async (empty) => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind: "authenticated", companies: empty ? [] : companies, activeCompany: null, user: null });
    await expect(CompanySettingsWorkspace()).rejects.toThrow(empty ? "REDIRECT:/dashboard/onboarding" : "REDIRECT:/select-company");
  });
  it.each(["denied", "unavailable"] as const)("withholds settings on %s", async (kind) => {
    vi.mocked(getDashboardContext).mockResolvedValue({ kind, error: new ApiError("network") });
    render(await CompanySettingsWorkspace()); expect(screen.getByRole("alert")).toBeDefined(); expect(screen.queryByText("Company settings manager")).toBeNull();
    expect(screen.getByRole("button", { name: "Sair" })).toBeDefined();
  });
});
