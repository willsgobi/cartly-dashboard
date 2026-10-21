import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "../../proxy";
import { sessionCookieName } from "./session";
import { appOrigin, testJwt } from "./__tests__/fixtures";

vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", appOrigin);
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));
});
afterEach(() => vi.unstubAllEnvs());

function request(path: string, token?: string) {
  return new NextRequest(appOrigin + path, { headers: token ? { cookie: `${sessionCookieName()}=${token}` } : {} });
}

describe("Next.js Proxy", () => {
  it("protects the dedicated selection route and keeps its safe login return", async () => {
    expect(config.matcher).toContain("/select-company");
    const response = await proxy(request("/select-company"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("returnTo")).toBe("/select-company");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("redirects missing sessions and preserves a safe internal return URL", async () => {
    const response = await proxy(request("/dashboard/orders?filter=active"));
    expect(response.status).toBe(303);
    const url = new URL(response.headers.get("location") ?? "");
    expect(url.origin).toBe(appOrigin);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("returnTo")).toBe("/dashboard/orders?filter=active");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([testJwt(1), "malformed"])("clears invalid local cookies before protected rendering", async (token) => {
    const response = await proxy(request("/dashboard", token));
    expect(response.status).toBe(303);
    expect(response.cookies.get(sessionCookieName())?.maxAge).toBe(0);
    expect(response.headers.get("location")).toContain("reason=expired");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses only an optimistic check on protected paths; the DAL must still verify", async () => {
    const response = await proxy(request("/dashboard", testJwt()));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not create a login redirect loop", async () => {
    const response = await proxy(request("/login?reason=expired"));
    expect(response.status).toBe(200);
    expect(response.headers.has("location")).toBe(false);
  });
  it("clears an authoritatively invalid token after a Server Component redirects", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const response = await proxy(request("/login?reason=expired", testJwt()));
    expect(response.cookies.get(sessionCookieName())?.maxAge).toBe(0);
    expect(response.headers.has("location")).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([200, 403, 500])("does not clear a live session from a crafted/stale login URL on backend %i", async (status) => {
    vi.mocked(fetch).mockResolvedValue(status === 200 ? Response.json([]) : new Response(null, { status }));
    const response = await proxy(request("/login?reason=expired", testJwt()));
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(response.headers.has("location")).toBe(false);
  });
});
