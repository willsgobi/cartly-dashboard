import { z } from "zod";
import type { components } from "../../lib/api/generated/schema";
import { parsePrice } from "./prices";

export type ProductType = components["schemas"]["ProductResponseDto"]["type"];
export const productTypes = ["NORMAL", "VARIANT", "VARIANT_WITH_PRICE"] as const;
export const typeLabels: Record<ProductType, string> = { NORMAL: "Normal", VARIANT: "Variações com preço único", VARIANT_WITH_PRICE: "Preço por variação" };
const name = z.string().trim().min(1, "Informe o nome do produto.");
const categoryId = z.string().min(1, "Selecione uma categoria.");
const positivePrice = z.number().finite().positive("Informe um preço maior que zero.");
const variantName = z.string().trim().min(1, "Informe o nome da variante.");
export const createVariantSchema = z.object({ name: variantName, price: positivePrice.nullable() }).strict();
export const updateVariantSchema = z.object({ name: variantName.optional(), price: positivePrice.nullable().optional() }).strict().refine((value) => value.name !== undefined || value.price !== undefined);
export type VariantUpdate = z.infer<typeof updateVariantSchema>;
const createBase = { name, description: z.string().trim().optional(), categoryId };
export const createProductSchema = z.discriminatedUnion("type", [
  z.object({ ...createBase, type: z.literal("NORMAL"), price: positivePrice }).strict(),
  z.object({ ...createBase, type: z.literal("VARIANT"), price: positivePrice, variants: z.array(z.object({ name: variantName, price: z.null() }).strict()).min(1) }).strict(),
  z.object({ ...createBase, type: z.literal("VARIANT_WITH_PRICE"), price: z.null(), variants: z.array(z.object({ name: variantName, price: positivePrice }).strict()).min(1) }).strict(),
]);
export const updateProductSchema = z.object({ name: name.optional(), description: z.string().trim().optional(), categoryId: categoryId.optional(), type: z.enum(productTypes).optional(), price: z.number().finite().positive().nullable().optional() }).strict();

// Numeric/null price and optional variant metadata reflect inspected NestJS runtime DTOs.
export const variantSchema = z.object({ id: z.string(), name: z.string(), price: z.number().finite().nullable(), productId: z.string().optional(), createdAt: z.iso.datetime({ offset: true }).optional(), updatedAt: z.iso.datetime({ offset: true }).optional() });
export type ProductVariant = z.infer<typeof variantSchema>;
export type VariantCreate = z.infer<typeof createVariantSchema>;
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
const formPrice = z.string().refine((value) => parsePrice(value) !== undefined, "Informe um preço maior que zero, como 12,50, sem perda de precisão.");
const formVariant = z.object({ name: variantName, price: z.string() });
const formBase = { name, description: z.string().trim(), categoryId };
const discriminatedProductFormSchema = z.discriminatedUnion("type", [
  z.object({ ...formBase, type: z.literal("NORMAL"), price: formPrice, variants: z.array(z.object({ name: z.string(), price: z.string() })) }),
  z.object({ ...formBase, type: z.literal("VARIANT"), price: formPrice, variants: z.array(formVariant).min(1, "Adicione pelo menos uma variante.") }),
  z.object({ ...formBase, type: z.literal("VARIANT_WITH_PRICE"), price: z.string(), variants: z.array(formVariant.extend({ price: formPrice })).min(1, "Adicione pelo menos uma variante.") }),
]);
const productFormBaseSchema = z.object({ ...formBase, type: z.enum(productTypes), price: z.string(), variants: z.array(z.object({ name: z.string(), price: z.string() })) });
export const productFormSchema = productFormBaseSchema.superRefine((values, context) => {
  const parsed = discriminatedProductFormSchema.safeParse(values);
  if (!parsed.success) for (const issue of parsed.error.issues) context.addIssue({ code: "custom", path: issue.path, message: issue.message });
});
// Product editing preserves existing variants; its form intentionally has no variant mutation fields.
export const editProductFormSchema = productFormBaseSchema.superRefine((values, context) => {
  if (values.type !== "VARIANT_WITH_PRICE" && parsePrice(values.price) === undefined) context.addIssue({ code: "custom", path: ["price"], message: "Informe um preço maior que zero, como 12,50, sem perda de precisão." });
});
export type ProductFormValues = z.infer<typeof productFormSchema>;
export function creationPayload(values: ProductFormValues): ProductCreate {
  const common = { name: values.name, ...(values.description ? { description: values.description } : {}), categoryId: values.categoryId };
  if (values.type === "NORMAL") return createProductSchema.parse({ ...common, type: values.type, price: parsePrice(values.price) });
  return createProductSchema.parse({ ...common, type: values.type, price: values.type === "VARIANT" ? parsePrice(values.price) : null, variants: values.variants.map((variant) => ({ name: variant.name, price: values.type === "VARIANT" ? null : parsePrice(variant.price) })) });
}
export const currency = (price: number | null | undefined) => price == null ? "Preço não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
