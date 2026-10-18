import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addVariant, fetchProduct, fetchProducts, patchVariant, removeProduct, removeVariant, saveProduct, variantError } from "./api";
import { ApiError } from "../../lib/api/errors";
import { product } from "./test-fixtures";
beforeEach(() => { vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(product)); });
afterEach(() => vi.unstubAllGlobals());
describe("product BFF browser adapter", () => {
  it("PATCHes the encoded variant URL with only changed fields", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: "v/id", productId: "p/id", name: "Novo", price: 45.5 }));
    const signal = new AbortController().signal; await patchVariant("a&b", "p/id", "v/id", { price: 45.5 }, signal);
    expect(fetch).toHaveBeenCalledWith("/api/products/p%2Fid/variants/v%2Fid?companyId=a%26b", expect.objectContaining({ method: "PATCH", body: '{"price":45.5}', signal, credentials: "same-origin", cache: "no-store" }));
  });
  it.each([400, 401, 403, 404, 500])("maps variant update HTTP %s without exposing error text", async (status) => {
    const replace = vi.fn(); vi.stubGlobal("window", { location: { replace } }); vi.mocked(fetch).mockResolvedValue(new Response("private", { status })); await expect(patchVariant("a", "p", "v", { name: "Novo" }, new AbortController().signal)).rejects.toMatchObject({ status }); expect(replace).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });
  it("encodes variant paths and company query without exposing tokens", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: "v", productId: "p/id", name: "P", price: 30 }));
    const signal = new AbortController().signal; await addVariant("a&b", "p/id", { name: "P", price: 30 }, signal);
    expect(fetch).toHaveBeenCalledWith("/api/products/p%2Fid/variants?companyId=a%26b", expect.objectContaining({ method: "POST", body: '{"name":"P","price":30}', credentials: "same-origin", signal }));
  });
  it("deletes variants with no body and retains the fixed BFF success", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ deleted: true })); await removeVariant("a&b", "p/id", "v/id", new AbortController().signal);
    const [path, options] = vi.mocked(fetch).mock.calls[0]; expect(path).toBe("/api/products/p%2Fid/variants/v%2Fid?companyId=a%26b"); expect(options?.method).toBe("DELETE"); expect(options?.body).toBeUndefined(); expect(new Headers(options?.headers).has("Content-Type")).toBe(false);
  });
  it.each([401, 403, 409])("preserves variant HTTP %s and only redirects 401", async (status) => {
    const replace = vi.fn(); vi.stubGlobal("window", { location: { replace } }); vi.mocked(fetch).mockResolvedValue(new Response("private", { status }));
    await expect(addVariant("a", "p", { name: "P", price: null }, new AbortController().signal)).rejects.toMatchObject({ status }); expect(replace).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    if (status === 409) expect(variantError(new ApiError("http", { status }))).toContain("Já existe uma variante");
  });
  it("forwards numeric JSON without tokens and encodes scope/path", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...product, id: "p/id", companyId: "a&b" }));
    await saveProduct("a&b", { price: 12.5 }, "p/id");
    expect(fetch).toHaveBeenCalledWith("/api/products/p%2Fid?companyId=a%26b", expect.objectContaining({ method: "PATCH", body: '{"price":12.5}', credentials: "same-origin", cache: "no-store" }));
  });
  it("lists and loads details using the BFF scope", async () => {
    const signal = new AbortController().signal;
    expect(await fetchProduct("a", "p", signal)).toEqual(product);
    vi.mocked(fetch).mockResolvedValue(Response.json([product])); expect(await fetchProducts("a", signal)).toEqual([product]);
  });
  it("handles the BFF's logical-deletion success", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ deleted: true })); await removeProduct("a", "p"); expect(fetch).toHaveBeenCalledWith("/api/products/p?companyId=a", expect.objectContaining({ method: "DELETE" }));
  });
  it.each([400, 401, 403, 404, 409, 500])("maps HTTP %s safely", async (status) => {
    const replace = vi.fn(); vi.stubGlobal("window", { location: { replace } });
    vi.mocked(fetch).mockResolvedValue(new Response("private", { status })); await expect(fetchProduct("a", "p", new AbortController().signal)).rejects.toMatchObject({ status });
    expect(replace).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    if (status === 401) expect(replace).toHaveBeenCalledWith("/login?reason=expired&returnTo=%2Fdashboard%2Fproducts");
  });
  it.each([{ ...product, companyId: "b" }, { ...product, id: "other" }, { ...product, price: {} }, null])("rejects malformed or mismatched detail %s", async (body) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(body)); await expect(fetchProduct("a", "p", new AbortController().signal)).rejects.toMatchObject({ kind: "invalid-response" });
  });
  it("distinguishes network failure and aborted work", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("network")); const controller = new AbortController();
    await expect(fetchProducts("a", controller.signal)).rejects.toMatchObject({ kind: "network" }); controller.abort(); await expect(fetchProducts("a", controller.signal)).rejects.toMatchObject({ kind: "aborted" });
  });
});
