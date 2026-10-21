import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleCompanySettings } from "./handlers";
import { getCompanyDetails, updateCompanyAddress, updateCompanyInformation } from "./service";
import { testJwt } from "../../../lib/auth/__tests__/fixtures";
import { companyCookieName } from "../../../lib/companies/selection";
import { sessionCookieName } from "../../../lib/auth/session";
import { details, companies } from "./test-fixtures";

vi.mock("server-only", () => ({}));
const token = testJwt();
const origin = "https://app.example.test";
function request(body?: unknown, addressId?: string, options: { origin?: string; session?: string; companyId?: string } = {}) {
  const companyId = options.companyId ?? "a";
  return new NextRequest(`${origin}/api/companies/${companyId}${addressId ? `/address/${addressId}` : ""}?companyId=a`, {
    method: body === undefined ? "GET" : "PATCH", headers: { Origin: options.origin ?? origin, Cookie: `${sessionCookieName()}=${options.session ?? token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin); vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).endsWith("/companies")) return Response.json([companies[0]]);
    return Response.json(details);
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("company settings authenticated BFF", () => {
  it("loads verified active-company details with exact GET, Bearer and no-store", async () => {
    const response = await handleCompanySettings(request(), "a");
    expect(response.status).toBe(200); expect(await response.json()).toEqual(details);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual(["https://api.example.test/companies", "https://api.example.test/companies/a"]);
    const options = vi.mocked(fetch).mock.calls[1][1];
    expect(options).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit" });
    expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${token}`);
  });
  it("forwards only changed company fields and returns no JWT", async () => {
    const response = await handleCompanySettings(request({ name: "Nova razão social" }), "a");
    expect(response.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ name: "Nova razão social" }) });
    expect(await response.text()).not.toContain(token);
  });
  it("verifies address membership then uses both path IDs and only the partial DTO", async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).endsWith("/companies")) return Response.json([companies[0]]);
      return Response.json(init?.method === "PATCH" ? { ...details.addresses[1], city: "Campinas" } : details);
    });
    const response = await handleCompanySettings(request({ city: "Campinas" }, "address-2"), "a", "address-2");
    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[2];
    expect(String(url)).toBe("https://api.example.test/companies/a/address/address-2");
    expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ city: "Campinas" }) });
  });
  it.each([{ number: "99" }, { companyId: "b" }, {}, { zipCode: "123" }, { street: "" }])("rejects unsupported/invalid address fields: %j", async (body) => {
    expect((await handleCompanySettings(request(body, "address-1"), "a", "address-1")).status).toBe(400);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([{}, { name: "" }, { document: "bad" }, { document: "04252011000110" }, { name: "Nova", document: "11222333000181" }, { addresses: [] }])("rejects invalid or immutable company edits: %j", async (body) => {
    expect((await handleCompanySettings(request(body), "a")).status).toBe(400);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("rejects an address outside the fresh parent before PATCH", async () => {
    expect((await handleCompanySettings(request({ street: "Rua nova" }, "foreign"), "a", "foreign")).status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });
  it("rejects a client path different from the active company", async () => {
    expect((await handleCompanySettings(request({ name: "Other" }, undefined, { companyId: "b" }), "b")).status).toBe(403);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("requires a valid preference when several companies are accessible", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(companies));
    expect((await handleCompanySettings(request(), "a")).status).toBe(403);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("rejects CSRF before any backend access", async () => {
    expect((await handleCompanySettings(request({ name: "No" }, undefined, { origin: "https://evil.test" }), "a")).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires a usable session even for reads", async () => {
    expect((await handleCompanySettings(request(undefined, undefined, { session: "invalid" }), "a")).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 409, 500])("preserves HTTP %i safely and clears only 401 sessions", async (status) => {
    vi.mocked(fetch).mockImplementation(async (url) => String(url).endsWith("/companies") ? Response.json([companies[0]]) : Response.json({ private: "stack secret" }, { status }));
    const response = await handleCompanySettings(request({ name: "Nova" }), "a");
    expect(response.status).toBe(status); expect(await response.text()).not.toContain("stack secret");
    expect(response.headers.has("set-cookie")).toBe(status === 401);
    if (status === 401) expect(response.cookies.get(companyCookieName())?.maxAge).toBe(0);
  });
  it.each(["network", "malformed", "foreign-company", "duplicate-address", "empty"])("withholds invalid details: %s", async (failure) => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith("/companies")) return Response.json([companies[0]]);
      if (failure === "network") throw new TypeError("private-hostname");
      if (failure === "empty") return new Response(null, { status: 204 });
      return Response.json(failure === "foreign-company" ? { ...details, id: "b" } : failure === "duplicate-address" ? { ...details, addresses: [details.addresses[0], details.addresses[0]] } : {});
    });
    const response = await handleCompanySettings(request(), "a");
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("private-hostname");
  });
});
describe("typed company services", () => {
  it("preserves string identifiers and normalizes no unknown response fields", async () => {
    vi.mocked(fetch).mockImplementation(async () => Response.json({ ...details, accessToken: "never-expose" }));
    expect(await getCompanyDetails(token, "a")).toEqual(details);
    await updateCompanyInformation(token, "a", { name: "Nova" });
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe(JSON.stringify({ name: "Nova" }));
  });
  it("rejects a mismatched address response ID", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(details.addresses[1]));
    await expect(updateCompanyAddress(token, "a", "address-1", { state: "RJ" })).rejects.toMatchObject({ kind: "invalid-response" });
  });
});
