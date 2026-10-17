import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProduct, fetchProducts, removeProduct, saveProduct } from "./api";
import { product } from "./test-fixtures";
beforeEach(() => { vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(product)); });
afterEach(() => vi.unstubAllGlobals());
describe("product BFF browser adapter", () => {
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
