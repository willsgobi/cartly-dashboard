import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("server-only", () => ({}));
import { handleProducts } from "./handlers";
import { testJwt } from "../../lib/auth/__tests__/fixtures";
import { sessionCookieName } from "../../lib/auth/session";
import { companyCookieName, setCompanySelection } from "../../lib/companies/selection";
import { product, categories, company } from "./test-fixtures";
const token = testJwt();
const input = { name: "Produto", categoryId: "cat", type: "NORMAL", price: 12.5 };
function request(method = "GET", body?: unknown, scope = "a", jwt = token, origin = "https://app.example.test") {
  const preference = new NextResponse(); setCompanySelection(preference, token, "a");
  return new NextRequest(`https://app.example.test/api/products?companyId=${scope}`, { method, headers: { Origin: origin, "Content-Type": "application/json", Cookie: `${sessionCookieName()}=${jwt}; ${companyCookieName()}=${encodeURIComponent(preference.cookies.get(companyCookieName())?.value ?? "")}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.test"); vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === "/companies") return Response.json([company, { ...company, id: "b" }]);
    if (path.endsWith("/categories")) return Response.json(categories);
    if (init?.method === "DELETE") return Response.json({ message: "Product deleted successfully." });
    return Response.json(path === "/products" && init?.method === "GET" ? [product] : product);
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("products typed service and authorized BFF", () => {
  it.each([undefined, "p"])("uses documented company query for list/detail %s", async (id) => {
    const response = await handleProducts(request(), id); expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[1]; expect(String(url)).toBe(`https://api.example.test/products${id ? "/p" : ""}?companyId=a`);
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`); expect(init?.cache).toBe("no-store"); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain(token);
  });
  it("creates only NORMAL with numeric price and server-derived company/category membership", async () => {
    expect((await handleProducts(request("POST", input))).status).toBe(201);
    const [url, init] = vi.mocked(fetch).mock.calls[2]; expect(String(url)).toBe("https://api.example.test/products");
    expect(init?.method).toBe("POST"); expect(JSON.parse(String(init?.body))).toEqual({ ...input, companyId: "a" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("PATCH includes companyId and only changed fields after checking existing invariants", async () => {
    expect((await handleProducts(request("PATCH", { name: "Novo" }), "p")).status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[3][1]?.body).toBe('{"name":"Novo","companyId":"a"}');
    expect(vi.mocked(fetch).mock.calls[3][1]?.method).toBe("PATCH");
  });
  it("DELETE sends exactly the required JSON body and preserves a 200 success", async () => {
    const response = await handleProducts(request("DELETE"), "p"); expect(response.status).toBe(200); expect(await response.json()).toEqual({ deleted: true });
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe('{"companyId":"a"}'); expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe("DELETE");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["b", "foreign", ""])("rejects stale/foreign scope %s before any product operation", async (scope) => {
    expect((await handleProducts(request("POST", input, scope))).status).toBe(403); expect(fetch).toHaveBeenCalledOnce();
  });
  it.each(["missing", "expired", "csrf"])("rejects %s before forwarding", async (scenario) => {
    const response = await handleProducts(request("POST", input, "a", scenario === "missing" ? "" : scenario === "expired" ? testJwt(1) : token, scenario === "csrf" ? "https://evil.test" : undefined));
    expect(response.status).toBe(scenario === "csrf" ? 403 : 401); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{ ...input, type: "VARIANT" }, { ...input, price: 0 }, { ...input, variants: [] }, { ...input, companyId: "foreign" }])("rejects unsupported/invalid creation %s", async (body) => {
    expect((await handleProducts(request("POST", body))).status).toBe(400); expect(fetch).toHaveBeenCalledOnce();
  });
  it("rejects another company's category before creation", async () => {
    expect((await handleProducts(request("POST", { ...input, categoryId: "foreign" }))).status).toBe(404); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("blocks type transitions without touching variants", async () => {
    expect((await handleProducts(request("PATCH", { type: "VARIANT" }), "p")).status).toBe(400); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("allows safe edits to existing variant products without submitting variants or type", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith("/companies")) return Response.json([company]);
      if (String(url).endsWith("/categories")) return Response.json(categories);
      return Response.json({ ...product, type: "VARIANT_WITH_PRICE", price: null, variants: [{ id: "v", name: "P", price: 2 }] });
    });
    expect((await handleProducts(request("PATCH", { name: "Novo" }), "p")).status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[3][1]?.body))).toEqual({ name: "Novo", companyId: "a" });
  });
  it("blocks product-level price on per-variant pricing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json({ ...product, type: "VARIANT_WITH_PRICE", price: null, variants: [{ id: "v", name: "P", price: 2 }] })).mockResolvedValueOnce(Response.json(categories));
    expect((await handleProducts(request("PATCH", { price: 2 }), "p")).status).toBe(400); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([400, 401, 403, 404, 409, 500])("preserves safe upstream HTTP %s and only clears cookies on 401", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(new Response("private diagnostics", { status }));
    const response = await handleProducts(request("DELETE"), "p"); expect(response.status).toBe(status); expect(await response.text()).not.toContain("private diagnostics"); expect(response.headers.has("set-cookie")).toBe(status === 401);
  });
  it.each(["foreign", "malformed", "network"])("handles %s responses safely", async (failure) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company]));
    if (failure === "network") vi.mocked(fetch).mockRejectedValueOnce(new TypeError("private"));
    else vi.mocked(fetch).mockResolvedValueOnce(failure === "foreign" ? Response.json([{ ...product, companyId: "b" }]) : new Response("broken-json"));
    expect((await handleProducts(request())).status).toBe(502); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
