import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCompany, lookupCompanyData } from "./api";

const replace = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
const input = { name: "Empresa", document: "11222333000181", address: { street: "Rua", number: "10", city: "Cidade", state: "SP", zipCode: "01001000", country: "Brazil" } };
beforeEach(() => { vi.stubGlobal("window", { location: { replace } }); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("onboarding browser BFF adapter", () => {
  it("creates through the local BFF and fully navigates only after verified activation", async () => {
    fetchMock.mockResolvedValue(Response.json({ created: true, active: true, companyId: "new-company" }));
    await createCompany(input);
    expect(fetchMock).toHaveBeenCalledWith("/api/companies", expect.objectContaining({ method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", body: JSON.stringify(input) }));
    expect(replace).toHaveBeenCalledExactlyOnceWith("/dashboard");
  });
  it("does not navigate or replay creation when synchronization remains pending", async () => {
    fetchMock.mockResolvedValue(Response.json({ created: true, active: false, companyId: "new-company" }));
    expect(await createCompany(input)).toMatchObject({ active: false });
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("sends lookup only to the local fixed operation, preserving cancellation", async () => {
    const signal = new AbortController().signal;
    fetchMock.mockResolvedValue(Response.json({ fields: { name: "Empresa", unsupported: "omit" } }));
    expect(await lookupCompanyData("cnpj", "11222333000181", signal)).toEqual({ name: "Empresa" });
    expect(fetchMock).toHaveBeenCalledWith("/api/lookups/cnpj?value=11222333000181", expect.objectContaining({ method: "POST", credentials: "same-origin", signal }));
  });
  it("reauthenticates only on 401, using a fixed internal URL", async () => {
    fetchMock.mockResolvedValue(Response.json({ redirectTo: "https://evil.test", error: "private" }, { status: 401 }));
    await expect(createCompany(input)).rejects.toMatchObject({ status: 401 });
    expect(replace).toHaveBeenCalledWith("/login?reason=expired&returnTo=%2Fdashboard%2Fonboarding");
  });
  it.each([400, 403, 409, 429, 500])("preserves safe HTTP %s without trusting diagnostics or redirecting", async (status) => {
    fetchMock.mockResolvedValue(new Response("private-details", { status }));
    await expect(createCompany(input)).rejects.toMatchObject({ status, kind: "http" });
    expect(replace).not.toHaveBeenCalled();
  });
  it("rejects malformed success JSON safely", async () => {
    fetchMock.mockResolvedValue(new Response("not-json"));
    await expect(createCompany(input)).rejects.toMatchObject({ kind: "invalid-response" });
    expect(replace).not.toHaveBeenCalled();
  });
});
