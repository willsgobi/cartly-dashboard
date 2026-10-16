import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { authenticatedErrorResponse, handleLogin, handleLogout, handleSession } from "./handlers";
import { ApiError } from "../api/errors";
import { sessionCookieName } from "./session";
import { companyCookieName } from "../companies/selection";
import { appOrigin, credentials, safeUser, testJwt } from "./__tests__/fixtures";

vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", appOrigin);
  vi.stubEnv("API_BASE_URL", "https://api.example.test/v1");
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected upstream request"));
});
afterEach(() => vi.unstubAllEnvs());

function loginRequest(input: unknown = credentials) {
  return new NextRequest(appOrigin + "/api/auth/login", {
    method: "POST", headers: { origin: appOrigin, "content-type": "application/json" }, body: JSON.stringify(input),
  });
}
function sessionRequest(token?: string, query = "") {
  return new NextRequest(appOrigin + "/api/auth/session" + query, {
    headers: token ? { cookie: `${sessionCookieName()}=${token}` } : {},
  });
}

describe("BFF login", () => {
  it("validates credentials, stores JWT and exposes only safe user information", async () => {
    const token = testJwt();
    vi.mocked(fetch).mockResolvedValue(Response.json({ accessToken: token, user: { ...safeUser, secret: "private-extra" } }));
    const response = await handleLogin(loginRequest({ ...credentials, returnTo: "/dashboard?view=summary" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: safeUser, returnTo: "/dashboard?view=summary" });
    expect(response.cookies.get(sessionCookieName())?.value).toBe(token);
    expect(response.cookies.get(companyCookieName())).toMatchObject({ value: "", maxAge: 0 });
    expect(response.headers.get("cache-control")).toContain("no-store");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/v1/auth/login");
    expect(init?.body).toBe(JSON.stringify(credentials));
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(init).toMatchObject({ credentials: "omit", cache: "no-store", redirect: "error" });
  });

  it("maps invalid credentials without leaking the upstream body", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ debug: "private-details" }, { status: 401 }));
    const response = await handleLogin(loginRequest());
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(JSON.stringify({ error: { kind: "http", message: "E-mail ou senha inválidos.", status: 401 } }));
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it.each([{}, { email: "bad", password: "password" }, { email: credentials.email, password: "" }, { email: credentials.email, password: 123 }])("validates inputs before contacting NestJS: %j", async (input) => {
    expect((await handleLogin(loginRequest(input))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["{broken", "x".repeat(17000)])("rejects malformed or oversized JSON", async (body) => {
    const response = await handleLogin(new NextRequest(appOrigin + "/api/auth/login", {
      method: "POST", headers: { origin: appOrigin, "content-type": "application/json" }, body,
    }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects form-encoded login", async () => {
    const response = await handleLogin(new NextRequest(appOrigin + "/api/auth/login", {
      method: "POST", headers: { origin: appOrigin, "content-type": "application/x-www-form-urlencoded" }, body: "email=test",
    }));
    expect(response.status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([{}, { accessToken: testJwt(), user: { id: "test-user" } }, { accessToken: testJwt(1), user: safeUser }, { accessToken: "invalid", user: safeUser }])("rejects unsafe upstream login responses", async (payload) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(payload));
    const response = await handleLogin(loginRequest());
    expect(response.status).toBe(502);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("sanitizes the return destination", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ accessToken: testJwt(), user: safeUser }));
    const response = await handleLogin(loginRequest({ ...credentials, returnTo: "https://evil.test" }));
    expect(await response.json()).toHaveProperty("returnTo", "/dashboard");
  });
});

describe("CSRF and logout", () => {
  it.each([undefined, "null", "https://evil.test", appOrigin + ".evil.test"])("rejects login and logout with Origin %j", async (origin) => {
    for (const handler of [handleLogin, handleLogout]) {
      const headers = new Headers({ host: "evil.test", "x-forwarded-host": "evil.test" });
      if (origin !== undefined) headers.set("origin", origin);
      const response = await handler(new NextRequest(appOrigin + "/api/auth/test", { method: "POST", headers }));
      expect(response.status).toBe(403);
      expect(response.headers.has("set-cookie")).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("logs out locally, removes the cookie and redirects without a backend logout", async () => {
    const response = await handleLogout(new NextRequest(appOrigin + "/api/auth/logout", {
      method: "POST", headers: { origin: appOrigin, cookie: `${sessionCookieName()}=${testJwt()}` },
    }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(appOrigin + "/login?returnTo=%2Fdashboard");
    expect(response.cookies.get(sessionCookieName())).toMatchObject({ value: "", maxAge: 0, path: "/", httpOnly: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("protected session verification", () => {
  it.each([401, 403, 409, 500])("normalizes authenticated operation failures (%i) at the response boundary", async (status) => {
    const response = authenticatedErrorResponse(new ApiError("http", { status, details: "private-diagnostic" }), "//evil.test");
    expect(response.status).toBe(status);
    expect(response.headers.has("set-cookie")).toBe(status === 401);
    const body: unknown = await response.json();
    expect(JSON.stringify(body)).not.toContain("private-diagnostic");
    if (status === 401) expect(body).toHaveProperty("redirectTo", "/login?returnTo=%2Fdashboard&reason=expired");
    else expect(body).not.toHaveProperty("redirectTo");
  });
  it.each([undefined, testJwt(1), "invalid"])("rejects missing, expired or malformed tokens before fetching", async (token) => {
    const response = await handleSession(sessionRequest(token));
    expect(response.status).toBe(401);
    expect(response.cookies.get(sessionCookieName())?.maxAge).toBe(0);
    expect(await response.json()).toHaveProperty("redirectTo");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards Bearer only to the configured backend and returns no tokens/data", async () => {
    const token = testJwt();
    vi.mocked(fetch).mockResolvedValue(Response.json([]));
    const response = await handleSession(sessionRequest(token, "?url=https://evil.test&path=/auth/login"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/v1/companies");
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`);
    expect(init).toMatchObject({ cache: "no-store", credentials: "omit", redirect: "error" });
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("invalidates a forged future-exp token after authoritative HTTP 401 without retry", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("private-debug", { status: 401 }));
    const response = await handleSession(sessionRequest(testJwt(), "?returnTo=https://evil.test"));
    expect(response.status).toBe(401);
    expect(response.cookies.get(sessionCookieName())?.maxAge).toBe(0);
    expect(await response.json()).toMatchObject({ redirectTo: "/login?returnTo=%2Fdashboard&reason=expired" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([403, 404, 500])("preserves HTTP %i without logout", async (status) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ private: "do-not-display" }, { status }));
    const response = await handleSession(sessionRequest(testJwt()));
    expect(response.status).toBe(status);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await response.text()).not.toContain("do-not-display");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not log out on network failure", async () => {
    const response = await handleSession(sessionRequest(testJwt()));
    expect(response.status).toBe(502);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("fails closed on an unexpected successful response", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ invented: true }));
    expect((await handleSession(sessionRequest(testJwt()))).status).toBe(502);
  });

  it("does not accept an incoming Bearer header instead of the HttpOnly cookie", async () => {
    const response = await handleSession(new NextRequest(appOrigin + "/api/auth/session", {
      headers: { Authorization: `Bearer ${testJwt()}` },
    }));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});
