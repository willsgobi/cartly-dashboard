import { describe, expect, it } from "vitest";
import { createProductSchema, decodeProduct, productFormSchema, validProductState } from "./schemas";
import { product } from "./test-fixtures";

describe("validated product models", () => {
  it.each([0, -1, NaN, Infinity, "12.5", {}, null])("rejects invalid NORMAL request price %s", (price) => {
    expect(createProductSchema.safeParse({ name: "Produto", categoryId: "cat", type: "NORMAL", price }).success).toBe(false);
  });
  it("trims names and preserves optional descriptions without variants", () => {
    expect(createProductSchema.parse({ name: "  Produto ", categoryId: "cat", type: "NORMAL", price: 12.5 })).toEqual({ name: "Produto", categoryId: "cat", type: "NORMAL", price: 12.5 });
    expect(createProductSchema.safeParse({ name: "Produto", categoryId: "cat", type: "NORMAL", price: 1, variants: [] }).success).toBe(false);
  });
  it.each(["VARIANT", "VARIANT_WITH_PRICE"])("defers creation of %s", (type) => {
    expect(createProductSchema.safeParse({ name: "Produto", categoryId: "cat", type, price: 12.5 }).success).toBe(false);
  });
  it.each(["12,50", "12.50", "1", "0,01"])("accepts positive decimal form price %s", (price) => {
    expect(productFormSchema.safeParse({ name: "Produto", description: "", categoryId: "cat", type: "NORMAL", price, variants: [] }).success).toBe(true);
  });
  it.each(["", "0", "-1", "1,2,3", "Infinity", "1.234,56"])("rejects ambiguous/nonpositive form price %s", (price) => {
    expect(productFormSchema.safeParse({ name: "Produto", description: "", categoryId: "cat", type: "NORMAL", price, variants: [] }).success).toBe(false);
  });
  it("decodes numeric/null prices, nullable optional data and local variant metadata differences", () => {
    expect(decodeProduct({ ...product, description: null, images: null, category: null }, "a").description).toBeNull();
    expect(decodeProduct({ ...product, price: null, type: "VARIANT_WITH_PRICE", variants: [{ id: "v", name: "P", price: 2 }] }, "a").variants).toHaveLength(1);
  });
  it.each([{ companyId: "b" }, { price: {} }, { price: "12.50" }, { category: { id: "foreign", name: "Other" } }, { variants: [{ id: "v", name: "P", price: 1, productId: "foreign" }] }])("rejects invalid scope/response %s", (override) => {
    expect(() => decodeProduct({ ...product, ...override }, "a", product.id)).toThrow();
  });
  it("validates all type/price/variant combinations without modifying records", () => {
    expect(validProductState(product)).toBe(true);
    expect(validProductState({ ...product, variants: [{ id: "v", name: "P", price: null }] })).toBe(false);
    expect(validProductState({ ...product, type: "VARIANT", variants: [] })).toBe(false);
    expect(validProductState({ ...product, type: "VARIANT", variants: [{ id: "v", name: "P", price: null }] })).toBe(true);
    expect(validProductState({ ...product, type: "VARIANT_WITH_PRICE", price: null, variants: [{ id: "v", name: "P", price: 2 }] })).toBe(true);
    expect(validProductState({ ...product, type: "VARIANT_WITH_PRICE", price: null, variants: [{ id: "v", name: "P", price: null }] })).toBe(false);
  });
});
