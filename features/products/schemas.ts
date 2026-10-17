import { z } from "zod";
import type { components } from "../../lib/api/generated/schema";

export type ProductType = components["schemas"]["ProductResponseDto"]["type"];
export const productTypes = ["NORMAL", "VARIANT", "VARIANT_WITH_PRICE"] as const;
export const typeLabels: Record<ProductType, string> = { NORMAL: "Normal", VARIANT: "Variações com preço único", VARIANT_WITH_PRICE: "Preço por variação" };
const name = z.string().trim().min(1, "Informe o nome do produto.");
const categoryId = z.string().min(1, "Selecione uma categoria.");
export const createProductSchema = z.object({ name, description: z.string().trim().optional(), categoryId, type: z.literal("NORMAL"), price: z.number().finite().positive("Informe um preço maior que zero.") }).strict();
export const updateProductSchema = z.object({ name: name.optional(), description: z.string().trim().optional(), categoryId: categoryId.optional(), type: z.enum(productTypes).optional(), price: z.number().finite().positive().nullable().optional() }).strict();

// Numeric/null price and optional variant metadata reflect inspected NestJS runtime DTOs.
const variantSchema = z.object({ id: z.string(), name: z.string(), price: z.number().finite().nullable(), productId: z.string().optional(), createdAt: z.iso.datetime({ offset: true }).optional(), updatedAt: z.iso.datetime({ offset: true }).optional() });
export const productSchema = z.object({
  id: z.string(), name: z.string(), description: z.string().nullish(), price: z.number().finite().nullish(),
  type: z.enum(productTypes), companyId: z.string(), categoryId: z.string(),
  category: z.object({ id: z.string(), name: z.string() }).nullish(),
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
  variants: z.array(variantSchema), images: z.array(z.object({ id: z.string(), url: z.string() })).nullish(),
});
export type Product = z.infer<typeof productSchema>;
export type ProductCreate = z.infer<typeof createProductSchema>;
export type ProductUpdate = z.infer<typeof updateProductSchema>;
export function decodeProduct(value: unknown, companyId: string, productId?: string): Product {
  const product = productSchema.parse(value);
  if (product.companyId !== companyId || (productId !== undefined && product.id !== productId) || (product.category && product.category.id !== product.categoryId) || product.variants.some((variant) => variant.productId !== undefined && variant.productId !== product.id)) throw new Error("Unexpected product scope");
  return product;
}
export function decodeProducts(value: unknown, companyId: string): Product[] {
  return z.array(z.unknown()).parse(value).map((product) => decodeProduct(product, companyId));
}
export function validProductState(product: Pick<Product, "type" | "price" | "variants">): boolean {
  if (product.type === "NORMAL") return typeof product.price === "number" && product.price > 0 && product.variants.length === 0;
  if (!product.variants.length) return false;
  if (product.type === "VARIANT") return typeof product.price === "number" && product.price > 0 && product.variants.every((variant) => variant.price === null);
  return product.price === null && product.variants.every((variant) => variant.price !== null && variant.price > 0);
}
export const productFormSchema = z.object({ name, description: z.string().trim(), categoryId, type: z.enum(productTypes), price: z.string() }).superRefine((values, context) => {
  if (values.type !== "VARIANT_WITH_PRICE" && (!/^\d+(?:[.,]\d+)?$/.test(values.price.trim()) || !Number.isFinite(Number(values.price.replace(",", "."))) || Number(values.price.replace(",", ".")) <= 0)) context.addIssue({ code: "custom", path: ["price"], message: "Informe um preço maior que zero, como 12,50." });
});
export type ProductFormValues = z.infer<typeof productFormSchema>;
export const currency = (price: number | null | undefined) => price == null ? "Preço não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
