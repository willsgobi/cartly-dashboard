import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset, resetPassword } from "./actions";
import { safeUser } from "../../lib/auth/__tests__/fixtures";

const { requestHeaders, cookiesMock } = vi.hoisted(() => ({ requestHeaders: vi.fn<() => Headers>(), cookiesMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: requestHeaders, cookies: cookiesMock }));
const input = { email: "test@example.com", otp: "00001234", password: "x" };

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://dashboard.example.test");
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  requestHeaders.mockReturnValue(new Headers({ Origin: "https://dashboard.example.test" }));
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected request"));
});
afterEach(() => vi.unstubAllEnvs());

describe("public password recovery actions", () => {
  it.each(["test@example.com", "unknown@example.com"])("ignores account-specific success wording for %s", async (email) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "private account information" }));
    expect(await requestPasswordReset({ email, password: "discard" })).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/auth/forgot-password");
    expect(JSON.parse(String(init?.body))).toEqual({ email });
    expect(init).toMatchObject({ credentials: "omit", cache: "no-store", redirect: "error", method: "POST" });
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(cookiesMock).not.toHaveBeenCalled();
  });
  it("sends the exact reset DTO, preserves zeros, and never accesses a session", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(safeUser));
    expect(await resetPassword({ ...input, confirmPassword: "discard", accessToken: "discard" })).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/auth/reset-password");
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect(init).toMatchObject({ credentials: "omit", cache: "no-store", redirect: "error", method: "POST" });
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(cookiesMock).not.toHaveBeenCalled();
  });
  it.each([{}, { email: "bad" }, { email: "" }])("validates recovery email before transport: %j", async (value) => {
    expect(await requestPasswordReset(value)).toMatchObject({ ok: false, status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["", "1234567", "123456789", "1234abcd", "１２３４５６７８"])("rejects invalid OTP %s", async (otp) => {
    expect(await resetPassword({ ...input, otp })).toMatchObject({ ok: false, status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 409, 500])("does not expose account existence or diagnostics for HTTP %i", async (status) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "Email not registered; private-hostname" }, { status }));
    const result = await requestPasswordReset({ email: input.email });
    expect(result).toMatchObject({ ok: false, status });
    expect(JSON.stringify(result)).not.toMatch(/not registered|private-hostname/);
    if (status !== 400) expect(result).toMatchObject({ message: "Não foi possível enviar o código. Tente novamente." });
  });
  it("groups invalid/expired/used/exhausted reset codes without guessing backend error codes", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "private expired OTP" }, { status: 400 }));
    expect(await resetPassword(input)).toEqual({ ok: false, status: 400, message: "Código inválido, expirado ou indisponível para uso. Confira os dados e tente novamente." });
  });
  it.each([requestPasswordReset, resetPassword])("rejects foreign/missing origins and does not touch sessions", async (action) => {
    for (const headers of [new Headers(), new Headers({ Origin: "https://evil.test" })]) {
      requestHeaders.mockReturnValue(headers);
      expect(await action(input)).toMatchObject({ ok: false, status: 403 });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(cookiesMock).not.toHaveBeenCalled();
  });
  it.each([requestPasswordReset, resetPassword])("maps transport failures safely", async (action) => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("private-hostname"));
    expect(await action(input)).toMatchObject({ ok: false, message: "Não foi possível conectar ao servidor. Tente novamente." });
  });
  it.each([requestPasswordReset, resetPassword])("rejects malformed and empty success bodies", async (action) => {
    for (const response of [Response.json({ unexpected: true }), new Response("invalid-json"), new Response(null)]) {
      vi.mocked(fetch).mockResolvedValue(response);
      expect(await action(input)).toMatchObject({ ok: false });
    }
  });
  it("rejects empty reset passwords without imposing a complexity policy", async () => {
    expect(await resetPassword({ ...input, password: "" })).toMatchObject({ ok: false, status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
