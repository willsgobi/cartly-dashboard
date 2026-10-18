import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { handleVariants } from "./variant-handlers";
import { testJwt } from "../../lib/auth/__tests__/fixtures";
import { sessionCookieName } from "../../lib/auth/session";
import { company, product } from "./test-fixtures";
const token = testJwt();
const variant = { id: "v", productId: "p", name: "P", price: 10, createdAt: product.createdAt, updatedAt: product.updatedAt };
const existing = { ...product, type: "VARIANT_WITH_PRICE", price: null, variants: [variant] };
function request(body: unknown, options: { companyId?: string; token?: string; origin?: string } = {}) { return new NextRequest(`https://app.example.test/api/products/p/variants/v?companyId=${options.companyId ?? "a"}`, { method: "PATCH", headers: { Origin: options.origin ?? "https://app.example.test", "Content-Type": "application/json", Cookie: `${sessionCookieName()}=${options.token ?? token}` }, body: JSON.stringify(body) }); }
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.test"); vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => String(url).endsWith("/companies") ? Response.json([company]) : options?.method === "PATCH" ? Response.json({ ...variant, ...JSON.parse(String(options.body)) }) : Response.json(existing));
});
afterEach(() => vi.unstubAllEnvs());
describe("F12 fixed partial variant updates", () => {
  it.each([{ name: " Grande " }, { price: 45.5 }, { name: "Grande", price: 45.5 }])("sends only supported changed fields %s", async (body) => {
    const response = await handleVariants(request(body), "p", "v"); expect(response.status).toBe(200);
    const [url, options] = vi.mocked(fetch).mock.calls[2]; expect(String(url)).toBe("https://api.example.test/products/p/variants/v?companyId=a"); expect(options?.method).toBe("PATCH"); expect(JSON.parse(String(options?.body))).toEqual({ ...body, ...(body.name ? { name: body.name.trim() } : {}) });
    expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${token}`); expect(options?.cache).toBe("no-store"); expect(response.headers.get("cache-control")).toContain("no-store"); expect(await response.text()).not.toContain(token);
  });
  it("updates a shared-price variant name without any price in the payload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json({ ...existing, type: "VARIANT", price: 25, variants: [{ ...variant, price: null }] })).mockResolvedValueOnce(Response.json({ ...variant, name: "Grande", price: null }));
    expect((await handleVariants(request({ name: "Grande" }), "p", "v")).status).toBe(200); expect(vi.mocked(fetch).mock.calls[2][1]?.body).toBe('{"name":"Grande"}');
  });
  it.each([{}, { name: " " }, { price: 0 }, { price: null }, { price: {} }, { companyId: "b" }, { name: "P", productId: "foreign" }])("rejects invalid/invariant-breaking patch %s", async (body) => {
    expect((await handleVariants(request(body), "p", "v")).status).toBe(400); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([null, 25])("rejects shared-price field %s even if supplied maliciously", async (price) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json({ ...existing, type: "VARIANT", price: 25, variants: [{ ...variant, price: null }] })); expect((await handleVariants(request({ price }), "p", "v")).status).toBe(400); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects NORMAL products and foreign variants", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json(product)); expect((await handleVariants(request({ name: "Grande" }), "p", "v")).status).toBe(400);
    expect((await handleVariants(request({ name: "Grande" }), "p", "other")).status).toBe(404);
  });
  it.each([400, 401, 403, 404, 500, 409])("preserves HTTP %s without exposing diagnostics", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json(existing)).mockResolvedValueOnce(new Response("private error", { status }));
    const response = await handleVariants(request({ name: "Grande" }), "p", "v"); expect(response.status).toBe(status); expect(response.headers.has("set-cookie")).toBe(status === 401); expect(await response.text()).not.toContain("private error");
  });
  it.each(["scope", "missing", "expired", "csrf"])("rejects invalid %s before product mutation", async (scenario) => {
    const response = await handleVariants(request({ name: "Grande" }, { companyId: scenario === "scope" ? "b" : "a", token: scenario === "missing" ? "" : scenario === "expired" ? testJwt(1) : token, origin: scenario === "csrf" ? "https://evil.test" : undefined }), "p", "v"); expect(response.status).toBe(scenario === "missing" || scenario === "expired" ? 401 : 403); expect(fetch).toHaveBeenCalledTimes(scenario === "scope" ? 1 : 0);
  });
  it.each(["network", "malformed", "foreign"])("handles %s response safely without retrying", async (failure) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([company])).mockResolvedValueOnce(Response.json(existing));
    if (failure === "network") vi.mocked(fetch).mockRejectedValueOnce(new TypeError("private")); else vi.mocked(fetch).mockResolvedValueOnce(failure === "malformed" ? new Response("broken") : Response.json({ ...variant, id: "other" }));
    expect((await handleVariants(request({ name: "Grande" }), "p", "v")).status).toBe(502); expect(fetch).toHaveBeenCalledTimes(3);
  });
});
