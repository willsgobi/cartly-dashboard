import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCompanyDetails, saveCompanyInformation, saveCompanyAddress, settingsError } from "./api";
import { informationChanges, addressChanges, updateAddressSchema, updateCompanySchema } from "./schemas";
import { ApiError } from "../../../lib/api/errors";
import { details, address } from "./test-fixtures";

beforeEach(() => { vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(details)); });
afterEach(() => vi.unstubAllGlobals());
describe("company settings browser adapter and partial DTOs", () => {
  it("uses fixed same-origin GET/PATCH paths, encoded scope, and cancellation", async () => {
    const controller = new AbortController(); await fetchCompanyDetails("a", controller.signal); await saveCompanyInformation("a", { name: "New" }, controller.signal);
    expect(vi.mocked(fetch).mock.calls[0]).toEqual(["/api/companies/a?companyId=a", expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal })]);
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ name: "New" }) });
    vi.mocked(fetch).mockResolvedValue(Response.json(address)); await saveCompanyAddress("a", "address-1", { city: "New" }, controller.signal);
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe("/api/companies/a/address/address-1?companyId=a");
  });
  it("omits immutable CNPJ and skips unchanged/formatting-only address updates", () => {
    expect(informationChanges({ name: details.name }, details)).toEqual({});
    expect(informationChanges({ name: "Nova" }, details)).toEqual({ name: "Nova" });
    expect(addressChanges({ street: address.street, city: address.city, state: address.state, zipCode: "01001-000", country: address.country }, address)).toEqual({});
    expect(updateAddressSchema.safeParse({ number: "2" }).success).toBe(false); expect(updateCompanySchema.safeParse({}).success).toBe(false);
    expect(updateCompanySchema.safeParse({ document: "11222333000181" }).success).toBe(false);
    expect(updateCompanySchema.safeParse({ name: "Nova", document: "04252011000110" }).success).toBe(false);
  });
  it("rejects another company's details and another address ID", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...details, id: "foreign" })); await expect(fetchCompanyDetails("a", new AbortController().signal)).rejects.toMatchObject({ kind: "invalid-response" });
    vi.mocked(fetch).mockResolvedValue(Response.json(address)); await expect(saveCompanyAddress("a", "foreign", { city: "New" }, new AbortController().signal)).rejects.toMatchObject({ kind: "invalid-response" });
  });
  it.each([400, 403, 404, 409, 500])("preserves HTTP %i without navigation or backend diagnostic exposure", async (status) => {
    const replace = vi.fn(); vi.stubGlobal("window", { location: { replace } }); vi.mocked(fetch).mockResolvedValue(Response.json({ secret: "private" }, { status }));
    await expect(saveCompanyInformation("a", { name: "New" }, new AbortController().signal)).rejects.toMatchObject({ status }); expect(replace).not.toHaveBeenCalled();
    expect(settingsError(new ApiError("http", { status }))).not.toContain("private");
  });
  it("reuses 401 login cleanup navigation with a safe settings return", async () => {
    const replace = vi.fn(); vi.stubGlobal("window", { location: { replace } }); vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(fetchCompanyDetails("a", new AbortController().signal)).rejects.toMatchObject({ status: 401 });
    expect(replace).toHaveBeenCalledWith("/login?reason=expired&returnTo=%2Fdashboard%2Fsettings%2Fcompany");
  });
  it("maps malformed and network failures safely", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("invalid")); await expect(fetchCompanyDetails("a", new AbortController().signal)).rejects.toMatchObject({ kind: "invalid-response" });
    vi.mocked(fetch).mockRejectedValue(new TypeError("private-hostname")); await expect(fetchCompanyDetails("a", new AbortController().signal)).rejects.toMatchObject({ kind: "network" });
  });
  it("maps document conflicts only for company-information updates", () => {
    const conflict = new ApiError("http", { status: 409 });
    expect(settingsError(conflict, "company")).toContain("CNPJ já está cadastrado");
    expect(settingsError(conflict)).toBe(conflict.message);
  });
});
