import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateAccount, registerAccount, resendActivation } from "./actions";
import { safeUser } from "../../lib/auth/__tests__/fixtures";

const { requestHeaders, cookiesMock } = vi.hoisted(() => ({
  requestHeaders: vi.fn<() => Headers>(), cookiesMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: requestHeaders, cookies: cookiesMock }));

const origin = "https://dashboard.example.test";
const registration = { name: "Pessoa de teste", email: "test@example.com", password: "x" };

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  requestHeaders.mockReturnValue(new Headers({ Origin: origin, "sec-fetch-site": "same-origin" }));
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected upstream request"));
});
afterEach(() => vi.unstubAllEnvs());

describe("registration action", () => {
  it("calls the documented endpoint and strips confirmPassword without creating a session", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(safeUser, { status: 201 }));
    expect(await registerAccount({ ...registration, confirmPassword: "x" })).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/auth/register");
    expect(init?.body).toBe(JSON.stringify(registration));
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(init).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store", redirect: "error" });
    expect(cookiesMock).not.toHaveBeenCalled();
  });
  it("validates on the server before calling the API", async () => {
    expect(await registerAccount({ ...registration, email: "invalid" })).toMatchObject({ ok: false, status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([400, 409])("maps registration HTTP %i safely", async (status) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "private-stack" }, { status }));
    const result = await registerAccount(registration);
    expect(result).toMatchObject({ ok: false, status });
    expect(JSON.stringify(result)).not.toContain("private-stack");
    if (!result.ok && status === 409) expect(result.message).toContain("já está cadastrado");
  });
});

describe("activation action", () => {
  it("forwards OTP as a string with leading zeros and does not authenticate", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(safeUser));
    const input = { email: registration.email, otp: "00001234" };
    expect(await activateAccount(input)).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/auth/activate-account");
    expect(init?.body).toBe(JSON.stringify(input));
    expect(cookiesMock).not.toHaveBeenCalled();
  });
  it("rejects invalid OTP before making a request", async () => {
    expect(await activateAccount({ email: registration.email, otp: "123" })).toMatchObject({ ok: false, status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("handles invalid, expired, used or exhausted OTP without exposing diagnostics", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ internal: "private-stack" }, { status: 400 }));
    const result = await activateAccount({ email: registration.email, otp: "00001234" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (!result.ok) expect(result.message).toContain("Código inválido, expirado");
    expect(JSON.stringify(result)).not.toContain("private-stack");
  });
});

describe("resend activation action", () => {
  it("sends email only and suppresses backend wording", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "private account-specific response" }));
    expect(await resendActivation({ email: registration.email, otp: "do-not-send" })).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/auth/resend-activation");
    expect(init?.body).toBe(JSON.stringify({ email: registration.email }));
    expect(cookiesMock).not.toHaveBeenCalled();
  });
  it("validates resend email and handles HTTP 400", async () => {
    expect(await resendActivation({ email: "bad" })).toMatchObject({ ok: false, status: 400 });
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 400 }));
    expect(await resendActivation({ email: registration.email })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("shared action security and failures", () => {
  it.each([registerAccount, activateAccount, resendActivation])("blocks foreign origins before upstream calls", async (action) => {
    requestHeaders.mockReturnValue(new Headers({ Origin: "https://evil.test" }));
    expect(await action({})).toMatchObject({ ok: false, status: 403 });
    expect(fetch).not.toHaveBeenCalled();
    expect(cookiesMock).not.toHaveBeenCalled();
  });
  it.each([registerAccount, activateAccount, resendActivation])("blocks missing Origin", async (action) => {
    requestHeaders.mockReturnValue(new Headers());
    expect(await action({})).toMatchObject({ ok: false, status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("handles network errors without exposing technical details", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("private-hostname"));
    const result = await registerAccount(registration);
    expect(result).toMatchObject({ ok: false, message: "Não foi possível conectar ao servidor. Tente novamente." });
    expect(JSON.stringify(result)).not.toContain("private-hostname");
  });
  it.each([Response.json({ unexpected: true }), new Response(null, { status: 201 })])("rejects malformed or empty successful payloads", async (response) => {
    vi.mocked(fetch).mockResolvedValue(response);
    expect(await registerAccount(registration)).toMatchObject({ ok: false });
  });
});
