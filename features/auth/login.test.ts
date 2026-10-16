import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "./login";

const fetchMock = vi.fn<typeof fetch>();
const replace = vi.fn();
const values = { email: "test@example.com", password: "synthetic-password" };
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { replace } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("browser login BFF adapter", () => {
  it("uses same-origin cookies and a full navigation to the server-sanitized destination", async () => {
    const returnTo = "/dashboard?tab=summary";
    fetchMock.mockResolvedValue(Response.json({ user: {}, returnTo }));
    await login(values, returnTo);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/auth/login", {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...values, returnTo }),
    });
    expect(replace).toHaveBeenCalledExactlyOnceWith(returnTo);
  });
  it.each([400, 401, 403, 500, 503])("preserves HTTP %s without trusting response diagnostics or navigating", async (status) => {
    fetchMock.mockResolvedValue(Response.json({ error: { message: "private-diagnostic" } }, { status }));
    await expect(login(values, "/dashboard")).rejects.toMatchObject({ kind: "http", status });
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("normalizes network failures without exposing details", async () => {
    fetchMock.mockRejectedValue(new TypeError("private-network"));
    await expect(login(values, "/dashboard")).rejects.toMatchObject({ kind: "network" });
    expect(replace).not.toHaveBeenCalled();
  });
  it.each(["not-json", "{}", '{"returnTo":"https://evil.test"}', '{"returnTo":"/login"}'])
    ("rejects malformed or unexpected success bodies: %s", async (body) => {
      fetchMock.mockResolvedValue(new Response(body));
      await expect(login(values, "/dashboard")).rejects.toMatchObject({ kind: "invalid-response" });
      expect(replace).not.toHaveBeenCalled();
    });
});
