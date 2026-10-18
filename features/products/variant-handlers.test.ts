import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { handleVariants } from "./variant-handlers";
import { testJwt } from "../../lib/auth/__tests__/fixtures";
import { sessionCookieName } from "../../lib/auth/session";
import { company, product } from "./test-fixtures";
const token = testJwt();
const variant = { id: "v", productId: "p", name: "P", price: null, createdAt: product.createdAt, updatedAt: product.updatedAt };
const existing = { ...product, type: "VARIANT", variants: [variant] };
function request(method = "POST", body?: unknown, scope = "a", jwt = token, origin = "https://app.example.test") {
  return new NextRequest(`https://app.example.test/api/products/p/variants?companyId=${scope}`, { method, headers: { Origin: origin, "Content-Type": "application/json", Cookie: `${sessionCookieName()}=${jwt}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.test"); vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
    if (String(url).endsWith("/companies")) return Response.json([company]);
    if (options?.method === "POST") return Response.json(variant, { status: 201 });
    if (options?.method === "DELETE") return Response.json({ message: "Product variant deleted successfully." });
    return Response.json(existing);
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("authenticated fixed variant operations", () => {
  it("creates through the documented path/query and forwards only trimmed name/null price", async () => {
    expect((await handleVariants(request("POST", { name: " P ", price: null }), "p")).status).toBe(201);
    const [url, options] = vi.mocked(fetch).mock.calls[2]; expect(String(url)).toBe("https://api.example.test/products/p/variants?companyId=a");
    expect(options?.body).toBe('{"name":"P","price":null}'); expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${token}`); expect(options?.cache).toBe("no-store");
  });
  it("creates a positive-price variant using existing per-variant strategy", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json({ ...existing, type: "VARIANT_WITH_PRICE", price: null, variants: [{ ...variant, price: 10 }] })).mockResolvedValueOnce(Response.json({ ...variant, price: 30.5 }));
    expect((await handleVariants(request("POST", { name: "P", price: 30.5 }), "p")).status).toBe(201); expect(vi.mocked(fetch).mock.calls[2][1]?.body).toBe('{"name":"P","price":30.5}');
  });
  it("physically deletes even the last variant without a body or fabricated guard", async () => {
    const response = await handleVariants(request("DELETE"), "p", "v"); expect(response.status).toBe(200); expect(await response.json()).toEqual({ deleted: true });
    const [url, options] = vi.mocked(fetch).mock.calls[2]; expect(String(url)).toBe("https://api.example.test/products/p/variants/v?companyId=a"); expect(options?.method).toBe("DELETE"); expect(options?.body).toBeUndefined(); expect(new Headers(options?.headers).has("Content-Type")).toBe(false);
  });
  it("allows restoring an empty variant-based product", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json({ ...existing, variants: [] })).mockResolvedValueOnce(Response.json(variant));
    expect((await handleVariants(request("POST", { name: "P", price: null }), "p")).status).toBe(201);
  });
  it.each(["POST", "DELETE"])("rejects %s on NORMAL", async (method) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json(product)); expect((await handleVariants(request(method, method === "POST" ? { name: "P", price: null } : undefined), "p", method === "DELETE" ? "v" : undefined)).status).toBe(400); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([{ name: "P", price: 1 }, { name: " ", price: null }, { name: "P", price: {} }, { name: "P", price: null, companyId: "b" }])("rejects invalid shared-price variant %s", async (body) => {
    expect((await handleVariants(request("POST", body), "p")).status).toBe(400); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects unknown variants and mismatched parent responses", async () => {
    expect((await handleVariants(request("DELETE"), "p", "foreign")).status).toBe(404); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([400, 401, 403, 404, 409, 500])("maps HTTP %s safely, clearing only expired authentication", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json(existing)).mockResolvedValueOnce(new Response("private details", { status }));
    const response = await handleVariants(request("POST", { name: "P", price: null }), "p"); expect(response.status).toBe(status); expect(await response.text()).not.toContain("private details"); expect(response.headers.has("set-cookie")).toBe(status === 401); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each(["foreign", "missing", "expired", "csrf"])("rejects %s context before variant calls", async (scenario) => {
    const response = await handleVariants(request("POST", { name: "P", price: null }, scenario === "foreign" ? "b" : "a", scenario === "missing" ? "" : scenario === "expired" ? testJwt(1) : token, scenario === "csrf" ? "https://evil.test" : undefined), "p");
    expect(response.status).toBe(scenario === "missing" || scenario === "expired" ? 401 : 403); expect(fetch).toHaveBeenCalledTimes(scenario === "foreign" ? 1 : 0);
  });
  it("rejects a response naming another parent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json(existing)).mockResolvedValueOnce(Response.json({ ...variant, productId: "other" })); expect((await handleVariants(request("POST", { name: "P", price: null }), "p")).status).toBe(502);
  });
  it("rejects a price field even when null for shared-price variant updates", async () => { expect((await handleVariants(request("PATCH", { name: "Changed", price: null }), "p", "v")).status).toBe(400); expect(fetch).toHaveBeenCalledTimes(2); });
});
