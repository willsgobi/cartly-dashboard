import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleCreateCompany } from "./create-handler";
import { testJwt } from "../../../lib/auth/__tests__/fixtures";
import { sessionCookieName } from "../../../lib/auth/session";
import { companyCookieName, resolveActiveCompany } from "../../../lib/companies/selection";

vi.mock("server-only", () => ({}));
const token = testJwt();
const input = { name: "Empresa", document: "11.222.333/0001-81", address: { street: "Rua", number: "1", city: "Cidade", state: "SP", zipCode: "01001-000", country: "Brazil" } };
const company = { ...input, document: "11222333000181", id: "new-company", createdAt: "now", address: { ...input.address, id: "address-id", zipCode: "01001000" } };
const list = [{ id: company.id, name: company.name, document: company.document, createdAt: "now", updatedAt: "now" }];
function request(body: unknown = input, cookie = token, origin = "https://app.example.test") {
  return new NextRequest("https://app.example.test/api/companies", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: `${sessionCookieName()}=${cookie}` }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.test");
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json(company)).mockResolvedValue(Response.json(list));
});
afterEach(() => vi.unstubAllEnvs());

describe("company creation and active company synchronization", () => {
  it("posts the exact normalized DTO once and activates only after GET verifies accessibility", async () => {
    const response = await handleCreateCompany(request({ ...input, unsupported: "omit", address: { ...input.address, district: "omit" } }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ created: true, active: true, companyId: company.id });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/companies");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({ ...input, document: "11222333000181", address: { ...input.address, zipCode: "01001000" } });
    expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${token}`);
    expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe("GET");
    expect(resolveActiveCompany([...list, { ...list[0], id: "other" }], token, response.cookies.get(companyCookieName())?.value)?.id).toBe(company.id);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it.each([400, 401, 403, 409, 500])("preserves a safe HTTP %s error without replaying creation", async (status) => {
    vi.mocked(fetch).mockReset().mockResolvedValue(new Response("private-diagnostic", { status }));
    const response = await handleCreateCompany(request());
    expect(response.status).toBe(status);
    expect(response.headers.has("set-cookie")).toBe(status === 401);
    const text = await response.text();
    expect(text).not.toContain("private-diagnostic");
    if (status === 409) expect(text).toContain("Já existe uma empresa");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each(["missing", "network", "unauthenticated"])("does not repeat a committed POST when synchronization is %s", async (failure) => {
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(Response.json(company));
    if (failure === "missing") vi.mocked(fetch).mockResolvedValue(Response.json([]));
    if (failure === "network") vi.mocked(fetch).mockRejectedValue(new TypeError("private-network"));
    if (failure === "unauthenticated") vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const response = await handleCreateCompany(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ created: true, active: false });
    expect(response.cookies.get(companyCookieName())?.maxAge).toBe(0);
    if (failure === "unauthenticated") expect(response.cookies.get(sessionCookieName())?.maxAge).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid input, missing sessions and cross-origin mutations before upstream work", async () => {
    expect((await handleCreateCompany(request({}))).status).toBe(400);
    expect((await handleCreateCompany(request(input, ""))).status).toBe(401);
    expect((await handleCreateCompany(request(input, token, "https://evil.test"))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects oversized JSON through the existing bounded reader", async () => {
    expect((await handleCreateCompany(request({ ...input, extra: "x".repeat(17000) }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
