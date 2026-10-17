import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoryErrorMessage, fetchCategories, removeCategory, saveCategory } from "./api";
import { ApiError } from "../../lib/api/errors";
const category = { id: "c/1", name: "Bebidas", companyId: "a&b", createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" };
beforeEach(() => { vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([category])); });
describe("category browser BFF adapter", () => {
  it("uses same-origin cookies and safely encodes company scope", async () => {
    const signal = new AbortController().signal;
    expect(await fetchCategories("a&b", signal)).toEqual([category]);
    expect(fetch).toHaveBeenCalledWith("/api/categories?companyId=a%26b", expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store", signal }));
  });
  it.each([undefined, "c/1"])("saves only the name through a fixed operation %s", async (id) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(category));
    await saveCategory("a&b", { name: "Bebidas" }, id);
    expect(fetch).toHaveBeenCalledWith(`/api/categories${id ? "/c%2F1" : ""}?companyId=a%26b`, expect.objectContaining({ method: id ? "PATCH" : "POST", body: '{"name":"Bebidas"}' }));
  });
  it("accepts empty 204 DELETE without parsing JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 })); await removeCategory("a&b", "c/1");
    expect(fetch).toHaveBeenCalledWith("/api/categories/c%2F1?companyId=a%26b", expect.objectContaining({ method: "DELETE" }));
  });
  it.each([400, 403, 404, 409, 500])("preserves HTTP %s without trusting raw error bodies", async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response("<private-error>", { status }));
    await expect(fetchCategories("a", new AbortController().signal)).rejects.toMatchObject({ status });
  });
  it("redirects 401 to the safe login destination", async () => {
    const replace = vi.fn(); vi.stubGlobal("window", { location: { replace } });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(fetchCategories("a", new AbortController().signal)).rejects.toMatchObject({ status: 401 });
    expect(replace).toHaveBeenCalledWith("/login?reason=expired&returnTo=%2Fdashboard%2Fcategories"); vi.unstubAllGlobals();
  });
  it.each(["broken JSON", [{ ...category, companyId: "other" }]])("rejects invalid successful bodies %s", async (body) => {
    vi.mocked(fetch).mockResolvedValue(typeof body === "string" ? new Response(body) : Response.json(body));
    await expect(fetchCategories("a&b", new AbortController().signal)).rejects.toMatchObject({ kind: "invalid-response" });
  });
  it("distinguishes network failure and cancellation", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("private-network"));
    const pending = new AbortController();
    await expect(fetchCategories("a", pending.signal)).rejects.toMatchObject({ kind: "network" });
    pending.abort(); await expect(fetchCategories("a", pending.signal)).rejects.toMatchObject({ kind: "aborted" });
  });
  it("maps duplicate names and linked-product deletion conflicts separately", () => {
    const failure = new ApiError("http", { status: 409, details: "private" });
    expect(categoryErrorMessage(failure)).toContain("Já existe uma categoria");
    expect(categoryErrorMessage(failure, true)).toContain("existem produtos vinculados");
    expect(categoryErrorMessage(new Error("secret"))).not.toContain("secret");
  });
});
