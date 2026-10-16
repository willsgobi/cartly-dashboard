import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireDashboardAccess } from "./guard";
import { testJwt } from "./__tests__/fixtures";

const { getCookie, redirectMock, connectionMock } = vi.hoisted(() => ({
  connectionMock: vi.fn<() => Promise<void>>(),
  getCookie: vi.fn<(name: string) => { value: string } | undefined>(),
  redirectMock: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/server", () => ({ connection: connectionMock }));

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  getCookie.mockReset();
  connectionMock.mockReset().mockResolvedValue();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));
});
afterEach(() => vi.unstubAllEnvs());

describe("server rendering boundary", () => {
  it("waits for an actual request before reading the session and evaluating current expiry", async () => {
    const now = Date.now();
    getCookie.mockReturnValue({ value: testJwt(Math.floor(now / 1000) + 30) });
    const request = Promise.withResolvers<void>();
    connectionMock.mockReturnValueOnce(request.promise);
    const access = requireDashboardAccess();
    expect(connectionMock).toHaveBeenCalledOnce();
    expect(getCookie).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();

    vi.spyOn(Date, "now").mockReturnValue(now + 31_000);
    const result = expect(access).rejects.toThrow("reason=expired");
    request.resolve();
    await result;
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never returns protected access without a cookie", async () => {
    await expect(requireDashboardAccess()).rejects.toThrow("REDIRECT:/login?returnTo=%2Fdashboard");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects locally expired tokens before rendering", async () => {
    getCookie.mockReturnValue({ value: testJwt(1) });
    await expect(requireDashboardAccess()).rejects.toThrow("reason=expired");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks the backend even if the cookie has a future exp", async () => {
    getCookie.mockReturnValue({ value: testJwt() });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(requireDashboardAccess()).rejects.toThrow("reason=expired");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("returns protected access only after a successful backend probe", async () => {
    getCookie.mockReturnValue({ value: testJwt() });
    await expect(requireDashboardAccess()).resolves.toEqual({ kind: "authenticated", companies: [] });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("returns an access-denied state on 403 without redirecting", async () => {
    getCookie.mockReturnValue({ value: testJwt() });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
    await expect(requireDashboardAccess()).resolves.toMatchObject({ kind: "denied", error: { status: 403 } });
    expect(redirectMock).not.toHaveBeenCalled();
  });
  it("fails closed when the backend is unavailable", async () => {
    getCookie.mockReturnValue({ value: testJwt() });
    vi.mocked(fetch).mockRejectedValue(new Error("private-network-detail"));
    await expect(requireDashboardAccess()).resolves.toMatchObject({ kind: "unavailable" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
