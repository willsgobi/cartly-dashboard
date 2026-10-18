import { describe, expect, it } from "vitest";
import { createProductSchema, creationPayload, productFormSchema } from "./schemas";
import { parsePrice } from "./prices";
const common = { name: "  Camiseta  ", description: "Algodão", categoryId: "cat" };
describe("F11 type-discriminated pricing", () => {
  it.each(["VARIANT", "VARIANT_WITH_PRICE"])("requires initial variants for %s", (type) => {
    expect(createProductSchema.safeParse({ ...common, type, price: type === "VARIANT" ? 5 : null, variants: [] }).success).toBe(false);
  });
  it("normalizes shared-price variants to null without touching retained form prices", () => {
    const values = productFormSchema.parse({ ...common, type: "VARIANT", price: "59,90", variants: [{ name: "  P ", price: "30,00" }, { name: "M", price: "not applicable" }] });
    expect(creationPayload(values)).toEqual({ ...common, name: "Camiseta", type: "VARIANT", price: 59.9, variants: [{ name: "P", price: null }, { name: "M", price: null }] });
    expect(values.variants[0].price).toBe("30,00");
  });
  it("normalizes individual prices and ignores hidden product price", () => {
    const values = productFormSchema.parse({ ...common, type: "VARIANT_WITH_PRICE", price: "stale", variants: [{ name: "P", price: "30,10" }, { name: "M", price: "40.50" }] });
    expect(creationPayload(values)).toEqual({ ...common, name: "Camiseta", type: "VARIANT_WITH_PRICE", price: null, variants: [{ name: "P", price: 30.1 }, { name: "M", price: 40.5 }] });
  });
  it("never sends hidden variants for NORMAL even when their values are incomplete", () => {
    expect(creationPayload(productFormSchema.parse({ ...common, type: "NORMAL", price: "12,50", variants: [{ name: "", price: "bad" }] }))).toEqual({ ...common, name: "Camiseta", type: "NORMAL", price: 12.5 });
  });
  it.each([{ type: "VARIANT", price: null, variants: [{ name: "P", price: null }] }, { type: "VARIANT", price: 5, variants: [{ name: "P", price: 5 }] }, { type: "VARIANT_WITH_PRICE", price: 5, variants: [{ name: "P", price: 5 }] }, { type: "VARIANT_WITH_PRICE", price: null, variants: [{ name: "P", price: null }] }, { type: "VARIANT_WITH_PRICE", price: null, variants: [{ name: " ", price: 1 }] }])("rejects invalid wire combinations %s", (fields) => {
    expect(createProductSchema.safeParse({ ...common, ...fields }).success).toBe(false);
  });
  it.each(["9007199254740993", "0.10000000000000001", "1.0000000000000001", "Infinity", "1,00,00"])("rejects imprecise/ambiguous decimal %s", (price) => { expect(parsePrice(price)).toBeUndefined(); });
  it.each([["12,5000", 12.5], ["00012.50", 12.5], ["0.0000001", 0.0000001], ["123456.78", 123456.78]] as const)("preserves representable decimal %s", (price, expected) => { expect(parsePrice(price)).toBe(expected); });
});
