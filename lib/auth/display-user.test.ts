import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { displayUserCookieName, readDisplayUser } from "./display-user";
import { clearSessionCookie, setSessionCookie } from "./session";
import { testJwt } from "./__tests__/fixtures";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());
const user = { name: "Pessoa de teste", email: "test@example.com" };

describe("session-bound display user", () => {
  it("retains only safe login display fields with JWT-bounded HttpOnly/Secure attributes", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = NextResponse.json({});
    const token = testJwt();
    setSessionCookie(response, token, user);
    const cookie = response.cookies.get(displayUserCookieName());
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(cookie?.maxAge).toBeLessThanOrEqual(300);
    expect(cookie?.value).not.toContain(token);
    expect(readDisplayUser(token, cookie?.value)).toEqual(user);
  });
  it("ignores modified or foreign-session display data without affecting authentication", () => {
    const response = NextResponse.json({});
    const token = testJwt();
    setSessionCookie(response, token, user);
    const raw = response.cookies.get(displayUserCookieName())?.value ?? "";
    expect(readDisplayUser(token, "changed" + raw)).toBeNull();
    expect(readDisplayUser("other-session", raw)).toBeNull();
    expect(readDisplayUser(token, "invalid")).toBeNull();
    expect(readDisplayUser(token)).toBeNull();
  });
  it("clears display data on logout and replacement without a profile", () => {
    const response = NextResponse.json({});
    setSessionCookie(response, testJwt(), user);
    clearSessionCookie(response);
    expect(response.cookies.get(displayUserCookieName())).toMatchObject({ value: "", maxAge: 0 });
    setSessionCookie(response, testJwt());
    expect(response.cookies.get(displayUserCookieName())?.maxAge).toBe(0);
  });
});
