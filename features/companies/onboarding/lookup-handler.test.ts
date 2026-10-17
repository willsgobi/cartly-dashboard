import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleLookup } from "./lookup-handler";
import { lookupLimiters } from "./rate-limit";
import { testJwt } from "../../../lib/auth/__tests__/fixtures";
import { sessionCookieName } from "../../../lib/auth/session";
import type { LookupKind } from "./schemas";

vi.mock("server-only", () => ({}));
const receita = { status: "OK", nome: "Empresa", cnpj: "11.222.333/0001-81", logradouro: "Rua", numero: "12", municipio: "Cidade", uf: "SP", cep: "01.001-000", telefone: "must-not-return" };
const address = { cep: "01001-000", logradouro: "Praça", localidade: "São Paulo", uf: "SP" };
function request(kind: LookupKind, value = kind === "cnpj" ? "11.222.333/0001-81" : "01001-000", token = testJwt(), origin = "https://app.example.test") {
  return new NextRequest(`https://app.example.test/api/lookups/${kind}?value=${encodeURIComponent(value)}`, { method: "POST", headers: { Origin: origin, Cookie: `${sessionCookieName()}=${token}` } });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.test");
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.spyOn(lookupLimiters.cnpj, "take").mockReturnValue(0);
  vi.spyOn(lookupLimiters.cep, "take").mockReturnValue(0);
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json([])).mockResolvedValue(Response.json(receita));
});
afterEach(() => vi.unstubAllEnvs());

describe("authenticated external lookup routes", () => {
  it("authenticates first and sends a normalized CNPJ only to the fixed URL without credentials", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const response = await handleLookup(request("cnpj"), "cnpj");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const [url, options] = vi.mocked(fetch).mock.calls[1];
    expect(String(url)).toBe("https://receitaws.com.br/v1/cnpj/11222333000181");
    expect(options).toMatchObject({ credentials: "omit", cache: "no-store", redirect: "error", method: "GET" });
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
    expect(new Headers(options?.headers).has("Cookie")).toBe(false);
    expect(options?.signal).toBeDefined();
    expect(timeout).toHaveBeenCalledWith(8000);
    expect(await response.json()).toEqual({ fields: { name: "Empresa", "address.street": "Rua", "address.number": "12", "address.city": "Cidade", "address.state": "SP", "address.zipCode": "01001000", "address.country": "Brazil" } });
  });
  it.each(["11222333000182", "https://evil.test", "11111111111111"])("rejects invalid parameters before authentication/upstream requests", async (value) => {
    expect((await handleLookup(request("cnpj", value), "cnpj")).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("blocks missing sessions and foreign-origin requests", async () => {
    expect((await handleLookup(request("cnpj", undefined, ""), "cnpj")).status).toBe(401);
    expect((await handleLookup(request("cnpj", undefined, testJwt(), "https://evil.test"), "cnpj")).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403])("withholds the public lookup if NestJS rejects access with %s", async (status) => {
    vi.mocked(fetch).mockReset().mockResolvedValue(new Response(null, { status }));
    const response = await handleLookup(request("cnpj"), "cnpj");
    expect(response.status).toBe(status);
    expect(response.headers.has("set-cookie")).toBe(status === 401);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("enforces the shared quota before calling ReceitaWS", async () => {
    vi.mocked(lookupLimiters.cnpj.take).mockReturnValue(35);
    const response = await handleLookup(request("cnpj"), "cnpj");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("35");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([{ status: "ERROR", message: "private-detail" }, {}, { ...receita, nome: "" }])("handles ReceitaWS not found/missing data without diagnostics", async (body) => {
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(Response.json([])).mockResolvedValue(Response.json(body));
    const response = await handleLookup(request("cnpj"), "cnpj");
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-detail");
  });
  it.each([429, 500])("handles provider HTTP %s safely", async (status) => {
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(Response.json([])).mockResolvedValue(new Response("private-detail", { status }));
    const response = await handleLookup(request("cnpj"), "cnpj");
    expect(response.status).toBe(status === 429 ? 429 : 502);
    expect(await response.text()).not.toContain("private-detail");
  });
  it.each([new TypeError("private-network"), new DOMException("timed out", "TimeoutError")])("handles network failure or timeout", async (error) => {
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(Response.json([])).mockRejectedValue(error);
    const response = await handleLookup(request("cnpj"), "cnpj");
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("Preencha os dados manualmente");
  });
  it("validates the ViaCEP payload and maps no address number", async () => {
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(Response.json([])).mockResolvedValue(Response.json(address));
    const response = await handleLookup(request("cep"), "cep");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fields: { "address.street": "Praça", "address.city": "São Paulo", "address.state": "SP", "address.zipCode": "01001000" } });
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe("https://viacep.com.br/ws/01001000/json/");
  });
  it.each([{ erro: true }, { ...address, erro: "true" }, {}, { ...address, cep: "99999-999" }])("rejects nonexistent, malformed or mismatched CEPs despite HTTP 200", async (body) => {
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(Response.json([])).mockResolvedValue(Response.json(body));
    expect((await handleLookup(request("cep"), "cep")).status).toBe(404);
  });
});
