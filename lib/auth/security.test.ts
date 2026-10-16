import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { assertSameOrigin, getAppOrigin, loginLocation, safeReturnTo } from "./security";
import { appOrigin } from "./__tests__/fixtures";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());

describe("BFF origin and redirect policy", () => {
  it.each(["/dashboard", "/dashboard/orders?filter=active", "/dashboard/"])("preserves a safe destination: %s", (value) => {
    expect(safeReturnTo(value)).toBe(value);
  });
  it.each([undefined, null, "", "https://evil.test", "//evil.test", "//[", "/\\evil.test", "/api/auth/logout", "/login", "/dashboard/../login", "/dashboard/%2f%2fevil.test", "/dashboard\n", "/dashboard#fragment"])("prevents unsafe or looping returns: %j", (value) => {
    expect(safeReturnTo(value)).toBe("/dashboard");
  });
  it("builds a fixed local login destination", () => {
    expect(loginLocation("https://evil.test", true)).toBe("/login?returnTo=%2Fdashboard&reason=expired");
  });
  it.each([undefined, "/app", "https://user:secret@example.test", "https://dashboard.example.test/path"])("requires a trusted configured origin: %j", (origin) => {
    vi.stubEnv("APP_ORIGIN", origin);
    expect(() => getAppOrigin()).toThrow(expect.objectContaining({ kind: "configuration" }));
  });
  it("accepts only the configured origin even if request Host is different", () => {
    vi.stubEnv("APP_ORIGIN", appOrigin);
    expect(() => assertSameOrigin(new NextRequest("http://internal-host/api/auth/logout", {
      method: "POST", headers: { origin: appOrigin, "sec-fetch-site": "same-origin" },
    }))).not.toThrow();
  });
  it.each([{}, { origin: "null" }, { origin: "https://evil.test" }, { origin: appOrigin + ".evil.test" }, { origin: appOrigin, "sec-fetch-site": "cross-site" }])("rejects untrusted browser requests: %j", (headers) => {
    vi.stubEnv("APP_ORIGIN", appOrigin);
    const requestHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) requestHeaders.set(key, value);
    }
    expect(() => assertSameOrigin(new NextRequest(appOrigin, { method: "POST", headers: requestHeaders })))
      .toThrow(expect.objectContaining({ status: 403 }));
  });
});
