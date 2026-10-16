import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { companyCookieName, resolveActiveCompany, setCompanySelection } from "./selection";
import { clearSessionCookie } from "../auth/session";
import type { Company } from "../api/companies";

vi.mock("server-only", () => ({}));
const companies: Company[] = ["a", "b"].map((id) => ({ id, name: `Empresa ${id}`, document: id, createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z" }));
afterEach(() => vi.unstubAllEnvs());

function preference(token = "session-a", id = "b") {
  const response = NextResponse.json({});
  setCompanySelection(response, token, id);
  return response.cookies.get(companyCookieName())?.value;
}

describe("active company preference", () => {
  it("has no active company for an empty accessible list", () => {
    expect(resolveActiveCompany([], "session-a", preference())).toBeNull();
  });
  it("automatically selects the only accessible company regardless of stale preferences", () => {
    expect(resolveActiveCompany([companies[0]], "session-a", preference())).toEqual(companies[0]);
  });
  it("requires a choice for multiple companies without a preference", () => {
    expect(resolveActiveCompany(companies, "session-a")).toBeNull();
  });
  it("restores only a current member of the verified accessible list", () => {
    expect(resolveActiveCompany(companies, "session-a", preference())).toEqual(companies[1]);
    expect(resolveActiveCompany(companies, "session-a", preference("session-a", "removed"))).toBeNull();
  });
  it.each(["invalid-json", "null", "{}", "x".repeat(4000)])("ignores malformed persisted selections", (raw) => {
    expect(resolveActiveCompany(companies, "session-a", raw)).toBeNull();
  });
  it("isolates users/sessions even when they share the same accessible companies", () => {
    expect(resolveActiveCompany(companies, "session-b", preference("session-a"))).toBeNull();
  });
  it("stores a host-only HttpOnly Secure preference without the JWT in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = NextResponse.json({});
    setCompanySelection(response, "synthetic-token", "a");
    const cookie = response.cookies.get("__Host-cartly_company");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(cookie?.value).not.toContain("synthetic-token");
    expect(cookie?.domain).toBeUndefined();
  });
  it("logout/session invalidation deletes the active company preference", () => {
    const response = NextResponse.json({});
    setCompanySelection(response, "session-a", "b");
    clearSessionCookie(response);
    expect(response.cookies.get(companyCookieName())).toMatchObject({ value: "", maxAge: 0 });
  });
});
