import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createApiClient } from "./client";
import { ApiError } from "./errors";
import type { components } from "./generated/schema";

type Company = components["schemas"]["CompanyListResponseDto"];
const companies: Company[] = [{
  id: "company-id",
  name: "Empresa de teste",
  document: "12345678000199",
  createdAt: "2026-10-16T12:00:00Z",
  updatedAt: "2026-10-16T12:00:00Z",
}];

function isCompany(value: unknown): value is Company {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "string"
    && "name" in value && typeof value.name === "string"
    && "document" in value && typeof value.document === "string"
    && "createdAt" in value && typeof value.createdAt === "string"
    && "updatedAt" in value && typeof value.updatedAt === "string";
}

function decodeCompanies(value: unknown): Company[] {
  if (!Array.isArray(value) || !value.every(isCompany)) {
    throw new Error("Invalid company list");
  }
  return value;
}

function setup(response = Response.json(companies)) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  return {
    fetchMock,
    client: createApiClient({ baseUrl: "https://api.example.test/v1", fetch: fetchMock }),
  };
}

describe("API client", () => {
  it("uses native fetch by default", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(companies));
    const client = createApiClient({ baseUrl: "https://api.example.test" });
    await expect(client.request("GET", "/companies", { decode: decodeCompanies })).resolves.toEqual(companies);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("makes a typed GET with safe defaults and a path prefix", async () => {
    const { client, fetchMock } = setup();
    const result = await client.request("GET", "/companies", { decode: decodeCompanies });
    expectTypeOf(result).toEqualTypeOf<Company[] | undefined>();
    expect(result).toEqual(companies);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/v1/companies");
    expect(init).toMatchObject({ method: "GET", credentials: "omit", cache: "no-store", redirect: "error" });
    expect(init?.body).toBeUndefined();
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("keeps undecoded JSON unknown", async () => {
    const { client } = setup();
    const result = await client.request("GET", "/companies", {});
    expectTypeOf(result).toBeUnknown();
    expect(result).toEqual(companies);
  });

  it("sends POST JSON using a documented DTO", async () => {
    const payload = { name: "Bebidas" } satisfies components["schemas"]["CreateCategoryDto"];
    const { client, fetchMock } = setup(Response.json({ id: "category-id", ...payload, companyId: "company-id", createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z" }));
    await client.request("POST", "/companies/{companyId}/categories", {
      pathParams: { companyId: "company-id" }, body: payload,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/v1/companies/company-id/categories");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify(payload));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("sends PATCH JSON and preserves optional fields", async () => {
    const { client, fetchMock } = setup(Response.json({ ...companies[0], addresses: [] }));
    await client.request("PATCH", "/companies/{companyId}", {
      pathParams: { companyId: "company-id" }, body: { name: "Novo nome" },
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "PATCH", body: JSON.stringify({ name: "Novo nome" }),
    });
  });

  it("sends the required company context in a DELETE JSON body", async () => {
    const { client, fetchMock } = setup(Response.json({ message: "Product deleted successfully." }));
    await client.request("DELETE", "/products/{productId}", {
      pathParams: { productId: "product-id" }, body: { companyId: "company-id" },
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "DELETE", body: JSON.stringify({ companyId: "company-id" }),
    });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("serializes documented query and path parameters independently", async () => {
    const { client, fetchMock } = setup(Response.json({
      id: "product-id", name: "Produto de teste", description: "", type: "NORMAL",
      companyId: "company-id", categoryId: "category-id", variants: [],
      createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z",
    } satisfies components["schemas"]["ProductResponseDto"]));
    await client.request("GET", "/products/{productId}", {
      pathParams: { productId: "item /?#%" }, query: { companyId: "empresa & matriz/ç" },
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/v1/products/item%20%2F%3F%23%25");
    expect(url.searchParams.get("companyId")).toBe("empresa & matriz/ç");
  });

  it("retains every repeated placeholder in the ambiguous variant route", async () => {
    const { client, fetchMock } = setup(Response.json({
      id: "variant-id", productId: "product-id", name: "Grande", price: null,
      createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z",
    } satisfies components["schemas"]["ProductVariantResponseDto"]));
    await client.request("PATCH", "/products/{productId}/variants/{productId}/variants/{variantId}", {
      pathParams: { productId: "product-id", variantId: "variant-id" },
      query: { companyId: "company-id" }, body: { name: "Grande", price: null },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.test/v1/products/product-id/variants/product-id/variants/variant-id?companyId=company-id",
    );
  });

  it("injects a Bearer token only for the current request", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(companies));
    const client = createApiClient({ baseUrl: "https://api.example.test", fetch: fetchMock });
    await client.request("GET", "/companies", { token: "test-token", headers: { "X-Request-ID": "test-id" } });
    await client.request("GET", "/companies", {});
    const first = new Headers(fetchMock.mock.calls[0][1]?.headers);
    const second = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(first.get("Authorization")).toBe("Bearer test-token");
    expect(first.get("X-Request-ID")).toBe("test-id");
    expect(second.has("Authorization")).toBe(false);
  });

  it.each([400, 401, 403, 404, 409, 500])("maps HTTP %i without displaying server details", async (status) => {
    const details = { debug: "internal-stack-do-not-display" };
    const { client } = setup(Response.json(details, { status }));
    // These statuses are documented for category creation, except 500 (company creation).
    const request = status === 500
      ? client.request("POST", "/companies", {
          body: {
            name: "Empresa de teste", document: "12345678000199",
            address: { street: "Rua de teste", number: "1", city: "São Paulo", state: "SP", zipCode: "01001000", country: "Brazil" },
          },
        })
      : client.request("POST", "/companies/{companyId}/categories", {
          pathParams: { companyId: "company-id" }, body: { name: "Bebidas" },
        });
    const error: unknown = await request.catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError);
    if (!(error instanceof ApiError)) throw new Error("Expected ApiError");
    expect(error.kind).toBe("http");
    expect(error.status).toBe(status);
    expect(error.details).toEqual(details);
    expect(error.message).not.toContain(details.debug);
    expect(error.message).not.toMatch(/stack|debug/i);
  });

  it.each(["<html>Internal proxy details</html>", "{broken", "", "null", "42", '["unexpected"]'])(
    "handles an unexpected HTTP error body: %s", async (body) => {
      const { client } = setup(new Response(body, { status: 401 }));
      await expect(client.request("GET", "/companies", {})).rejects.toMatchObject({ kind: "http", status: 401 });
    },
  );

  it("preserves an unlisted HTTP status with a safe fallback", async () => {
    const { client } = setup(new Response("proxy failed", { status: 502 }));
    await expect(client.request("GET", "/companies", {})).rejects.toMatchObject({
      kind: "http", status: 502, message: "Não foi possível concluir a solicitação.",
    });
  });

  it("distinguishes a network failure without leaking its cause", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError("internal hostname"));
    await expect(client.request("GET", "/companies", {})).rejects.toMatchObject({
      kind: "network", status: undefined, details: undefined,
      message: "Não foi possível conectar ao servidor. Tente novamente.",
    });
  });

  it("handles DELETE without a body and empty HTTP 204", async () => {
    const { client, fetchMock } = setup(new Response(null, { status: 204 }));
    const decode = vi.fn(() => undefined);
    await expect(client.request("DELETE", "/companies/{companyId}/categories/{categoryId}", {
      pathParams: { companyId: "company-id", categoryId: "category-id" }, decode,
    })).resolves.toBeUndefined();
    expect(decode).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });

  it.each(["", " \n "])("handles empty successful bodies: %j", async (body) => {
    const { client } = setup(new Response(body));
    await expect(client.request("GET", "/companies", {})).resolves.toBeUndefined();
  });

  it("preserves JSON null rather than confusing it with an empty response", async () => {
    const { client } = setup(Response.json(null));
    await expect(client.request("GET", "/companies", {})).resolves.toBeNull();
  });

  it("rejects malformed JSON in a successful response", async () => {
    const { client } = setup(new Response("<html>not JSON</html>"));
    await expect(client.request("GET", "/companies", {})).rejects.toMatchObject({
      kind: "invalid-response", status: 200,
    });
  });

  it("rejects structurally unexpected JSON when decoding", async () => {
    const { client } = setup(Response.json([{ id: 5 }]));
    await expect(client.request("GET", "/companies", { decode: decodeCompanies })).rejects.toMatchObject({
      kind: "invalid-response", status: 200,
    });
  });

  it("normalizes pre-cancellation, including custom abort reasons", async () => {
    const { client, fetchMock } = setup();
    const controller = new AbortController();
    controller.abort("custom reason");
    await expect(client.request("GET", "/companies", { signal: controller.signal })).rejects.toMatchObject({
      kind: "aborted", status: undefined,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards AbortSignal and handles cancellation during a request", async () => {
    const { client, fetchMock } = setup();
    const controller = new AbortController();
    const pending = Promise.withResolvers<Response>();
    fetchMock.mockImplementation((input, init) => {
      expect(input).toBeInstanceOf(URL);
      expect(init?.signal).toBe(controller.signal);
      init?.signal?.addEventListener("abort", () => pending.reject(controller.signal.reason), { once: true });
      return pending.promise;
    });
    const request = client.request("GET", "/companies", { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ kind: "aborted", status: undefined });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("recognizes AbortError from fetch even without a supplied signal", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(client.request("GET", "/companies", {})).rejects.toMatchObject({ kind: "aborted" });
  });

  it.each([200, 401])("preserves HTTP status when a response stream fails (%i)", async (status) => {
    const response = new Response(new ReadableStream({
      start(controller) { controller.error(new TypeError("stream failed")); },
    }), { status });
    const { client } = setup(response);
    await expect(client.request("GET", "/companies", {})).rejects.toMatchObject({
      kind: status === 200 ? "network" : "http", status,
    });
  });

  it("handles cancellation while reading the response body", async () => {
    const response = new Response(new ReadableStream({
      start(controller) { controller.error(new DOMException("Aborted", "AbortError")); },
    }));
    const { client } = setup(response);
    await expect(client.request("GET", "/companies", {})).rejects.toMatchObject({ kind: "aborted", status: 200 });
  });

  it.each(["", "   ", "invalid\r\nheader"])("rejects invalid Bearer headers before fetch: %j", async (token) => {
    const { client, fetchMock } = setup();
    await expect(client.request("GET", "/companies", { token })).rejects.toMatchObject({ kind: "request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
