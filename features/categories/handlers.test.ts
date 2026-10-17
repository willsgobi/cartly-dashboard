import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("server-only", () => ({}));
import { handleCategories } from "./handlers";
import { testJwt } from "../../lib/auth/__tests__/fixtures";
import { sessionCookieName } from "../../lib/auth/session";
import { companyCookieName, setCompanySelection } from "../../lib/companies/selection";

const token = testJwt();
const companies = ["a", "b"].map((id) => ({ id, name: id, document: id, createdAt: "now", updatedAt: "now" }));
const category = { id: "category-1", companyId: "a", name: "Bebidas", createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" };
function request(method = "GET", options: { companyId?: string; selected?: string; body?: unknown; token?: string; origin?: string; contentType?: string } = {}) {
  const jwt = options.token ?? token;
  const cookie = new NextResponse();
  setCompanySelection(cookie, jwt, options.selected ?? "a");
  return new NextRequest(`https://app.example.test/api/categories?companyId=${options.companyId ?? "a"}`, {
    method,
    headers: { Origin: options.origin ?? "https://app.example.test", "Content-Type": options.contentType ?? "application/json", Cookie: `${sessionCookieName()}=${jwt}; ${companyCookieName()}=${encodeURIComponent(cookie.cookies.get(companyCookieName())?.value ?? "")}` },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.test"); vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => String(url).endsWith("/companies") ? Response.json(companies) : Response.json([category]));
});
afterEach(() => vi.unstubAllEnvs());

describe("authenticated category BFF and typed service", () => {
  it("lists only the verified active company through the authenticated client", async () => {
    const response = await handleCategories(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual([category]);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = vi.mocked(fetch).mock.calls[1];
    expect(String(url)).toBe("https://api.example.test/companies/a/categories");
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`);
    expect(init?.cache).toBe("no-store"); expect(init?.body).toBeUndefined();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(JSON.stringify(await (await handleCategories(request())).json())).not.toContain(token);
  });
  it.each(["POST", "PATCH"])("sends only the trimmed name for %s and validates the response", async (method) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(companies)).mockResolvedValueOnce(Response.json(category));
    const response = await handleCategories(request(method, { body: { name: "  Bebidas  ", companyId: "b", role: "ADMIN" } }), method === "PATCH" ? category.id : undefined);
    expect(response.status).toBe(method === "POST" ? 201 : 200); expect(await response.json()).toEqual(category);
    const [url, init] = vi.mocked(fetch).mock.calls[1];
    expect(String(url)).toBe(`https://api.example.test/companies/a/categories${method === "PATCH" ? "/category-1" : ""}`);
    expect(init?.method).toBe(method); expect(JSON.parse(String(init?.body))).toEqual({ name: "Bebidas" });
  });
  it("preserves optional PATCH fields without inventing defaults", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(companies)).mockResolvedValueOnce(Response.json(category));
    expect((await handleCategories(request("PATCH", { body: {} }), category.id)).status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe("{}");
  });
  it("handles physical DELETE with no request or 204 response body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(companies)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await handleCategories(request("DELETE"), category.id);
    expect(response.status).toBe(204); expect(await response.text()).toBe("");
    expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe("DELETE");
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBeUndefined();
  });
  it.each([400, 401, 403, 404, 409, 500])("preserves upstream HTTP %s safely and only clears a session on 401", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(companies)).mockResolvedValueOnce(new Response("private diagnostic", { status }));
    const response = await handleCategories(request("DELETE"), category.id);
    expect(response.status).toBe(status); expect(await response.text()).not.toContain("private diagnostic");
    expect(response.headers.has("set-cookie")).toBe(status === 401);
    if (status === 401) expect(response.cookies.get(sessionCookieName())?.maxAge).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["foreign", "stale", "unselected", "removed", "other-session"])("blocks %s company context before any category request", async (scenario) => {
    const req = request("POST", { body: { name: "Bebidas" }, companyId: scenario === "foreign" ? "foreign" : "b", selected: scenario === "removed" ? "removed" : "a" });
    if (scenario === "unselected") req.cookies.delete(companyCookieName());
    if (scenario === "other-session") req.cookies.set(sessionCookieName(), testJwt(Math.floor(Date.now() / 1000) + 900));
    expect((await handleCategories(req)).status).toBe(403);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("automatically uses the only accessible company without a preference", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([companies[0]])).mockResolvedValueOnce(Response.json([]));
    const req = request(); req.cookies.delete(companyCookieName());
    expect(await (await handleCategories(req)).json()).toEqual([]);
  });
  it.each(["missing", "expired", "csrf"])("rejects %s credentials/origin without calling the API", async (scenario) => {
    const req = request("POST", { body: { name: "Bebidas" }, token: scenario === "expired" ? testJwt(1) : scenario === "missing" ? "" : token, origin: scenario === "csrf" ? "https://evil.test" : undefined });
    expect((await handleCategories(req)).status).toBe(scenario === "csrf" ? 403 : 401); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["", "   ", null, 123])("rejects invalid names %s without a mutation", async (name) => {
    expect((await handleCategories(request("POST", { body: { name } }))).status).toBe(400); expect(fetch).toHaveBeenCalledOnce();
  });
  it("rejects oversized JSON and unsupported content types", async () => {
    expect((await handleCategories(request("POST", { body: { name: "x".repeat(17000) } }))).status).toBe(400);
    expect((await handleCategories(request("POST", { body: { name: "Bebidas" }, contentType: "text/plain" }))).status).toBe(415);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([[{ ...category, companyId: "b" }], [{ ...category, createdAt: "invalid" }], {}, undefined])("rejects unexpected or cross-company response data %s", async (value) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(companies)).mockResolvedValueOnce(value === undefined ? new Response(null, { status: 204 }) : Response.json(value));
    expect((await handleCategories(request())).status).toBe(502);
  });
  it("rejects an update response for another category", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(companies)).mockResolvedValueOnce(Response.json({ ...category, id: "foreign" }));
    expect((await handleCategories(request("PATCH", { body: { name: "Novo" } }), category.id)).status).toBe(502);
  });
  it("maps network errors without exposing diagnostics or replaying mutations", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(companies)).mockRejectedValueOnce(new Error("private network"));
    const response = await handleCategories(request("POST", { body: { name: "Bebidas" } }));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("private network"); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
