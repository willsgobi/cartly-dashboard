import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { clearSessionCookie, getJwtExpiration, requireSessionToken, sessionCookieName, setSessionCookie } from "./session";
import { testJwt } from "./__tests__/fixtures";

vi.mock("server-only", () => ({}));
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("JWT cookie lifecycle", () => {
  it.each(["production", "development"])("uses secure cookie attributes in %s", (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00.250Z"));
    const exp = Date.now() / 1000 + 300;
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, testJwt(exp));
    const cookie = response.cookies.get(sessionCookieName());
    expect(cookie).toMatchObject({ httpOnly: true, secure: environment === "production", sameSite: "lax", path: "/", maxAge: 300 });
    expect(cookie?.expires?.valueOf()).toBeLessThanOrEqual(exp * 1000);
    expect(cookie).not.toHaveProperty("domain");
    expect(sessionCookieName().startsWith("__Host-")).toBe(environment === "production");
    clearSessionCookie(response);
    expect(response.cookies.get(sessionCookieName())).toMatchObject({ value: "", maxAge: 0, path: "/", httpOnly: true });
  });

  it("does not extend cookie lifetime on reads", () => {
    const token = testJwt();
    expect(requireSessionToken(token)).toBe(token);
    expect(getJwtExpiration(token)).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects missing and expired tokens", () => {
    expect(() => requireSessionToken(undefined)).toThrow(expect.objectContaining({ status: 401, reason: "missing" }));
    expect(() => requireSessionToken(testJwt(1))).toThrow(expect.objectContaining({ status: 401, reason: "expired" }));
  });

  it.each([null, "123", -1, 0, 1e20])("rejects missing or unsafe exp: %j", (exp) => {
    expect(getJwtExpiration(testJwt(exp))).toBeUndefined();
  });

  it("rejects JWTs without an exp instead of inventing their lifetime", () => {
    const parts = testJwt().split(".");
    parts[1] = Buffer.from("{}").toString("base64url");
    expect(getJwtExpiration(parts.join("."))).toBeUndefined();
  });

  it.each(["", "not-a-jwt", "a.b.c", "a.b.", testJwt(1, "none"), "a".repeat(4000)])("rejects malformed tokens without logging: %s", (token) => {
    expect(getJwtExpiration(token)).toBeUndefined();
    expect(() => setSessionCookie(NextResponse.json({}), token)).toThrow();
  });

  it("does not create a cookie from an already expired upstream token", () => {
    const response = NextResponse.json({});
    expect(() => setSessionCookie(response, testJwt(1))).toThrow(expect.objectContaining({ kind: "invalid-response" }));
    expect(response.headers.has("set-cookie")).toBe(false);
  });
});
