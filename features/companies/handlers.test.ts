import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleCompanySelection } from "./handlers";
import { testJwt } from "../../lib/auth/__tests__/fixtures";
import { companyCookieName, resolveActiveCompany } from "../../lib/companies/selection";
import { sessionCookieName } from "../../lib/auth/session";

vi.mock("server-only", () => ({}));
const token = testJwt();
const companies = ["a", "b"].map((id) => ({ id, name: `Empresa ${id}`, document: id, createdAt: "now", updatedAt: "now" }));
function request(companyId = "b", origin = "https://app.example.test", session: string | undefined = token) {
  return new NextRequest("https://app.example.test/api/companies/active", {
    method: "POST", headers: { Origin: origin, ...(session ? { Cookie: `${sessionCookieName()}=${session}` } : {}) },
    body: new URLSearchParams({ companyId }),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.test");
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(companies));
});
afterEach(() => vi.unstubAllEnvs());

describe("active company POST boundary", () => {
  it("revalidates membership with Bearer/no-store before saving and fully redirects", async () => {
    const response = await handleCompanySelection(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example.test/dashboard");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/companies");
    expect(options).toMatchObject({ cache: "no-store", method: "GET" });
    expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${token}`);
    expect(resolveActiveCompany(companies, token, response.cookies.get(companyCookieName())?.value)?.id).toBe("b");
  });
  it("supports switching to another accessible company", async () => {
    const response = await handleCompanySelection(request("a"));
    expect(resolveActiveCompany(companies, token, response.cookies.get(companyCookieName())?.value)?.id).toBe("a");
  });
  it.each([{ list: [] }, { list: companies }])("rejects unavailable or removed company IDs", async ({ list }) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(list));
    const response = await handleCompanySelection(request("other-user-company"));
    expect(response.headers.get("location")).toContain("companyError=invalid");
    expect(response.cookies.get(companyCookieName())).toMatchObject({ value: "", maxAge: 0 });
  });
  it("rejects an empty choice without querying the backend", async () => {
    const response = await handleCompanySelection(request(""));
    expect(response.headers.get("location")).toContain("companyError=invalid");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects foreign-origin mutations before any API/cookie change", async () => {
    const response = await handleCompanySelection(request("a", "https://evil.test"));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("redirects missing sessions without calling NestJS", async () => {
    const response = await handleCompanySelection(request("a", "https://app.example.test", ""));
    expect(response.headers.get("location")).toContain("/login?");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("clears session and company cookies after an authoritative 401", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const response = await handleCompanySelection(request());
    expect(response.headers.get("location")).toContain("reason=expired");
    for (const name of [companyCookieName(), sessionCookieName()]) expect(response.cookies.get(name)?.maxAge).toBe(0);
  });
  it("preserves the session on 403", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
    const response = await handleCompanySelection(request());
    expect(response.headers.get("location")).toContain("companyError=denied");
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it.each(["network", "malformed", "empty"])("fails safely on %s without persisting a choice", async (failure) => {
    if (failure === "network") vi.mocked(fetch).mockRejectedValue(new TypeError("private-details"));
    if (failure === "malformed") vi.mocked(fetch).mockResolvedValue(Response.json([{}]));
    if (failure === "empty") vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const response = await handleCompanySelection(request());
    expect(response.headers.get("location")).toContain("companyError=unavailable");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await response.text()).not.toContain("private-details");
  });
});
