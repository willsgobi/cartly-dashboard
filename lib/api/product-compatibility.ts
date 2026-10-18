import type { components } from "./generated/schema";

/** Explicit F10/F11/F12 compatibility: inspected NestJS DTOs accept number|null; Swagger says object.
 * Keep generated types untouched. See docs/frontend/modules/products.md for evidence/limits.
 */
export type ProductVariantCreateRequest = Omit<components["schemas"]["CreateProductVariantDto"], "price"> & { price?: number | null };
export type ProductCreateRequest = Omit<components["schemas"]["CreateProductDto"], "price" | "variants"> & { price?: number | null; variants?: ProductVariantCreateRequest[] };
export type ProductUpdateRequest = Omit<components["schemas"]["UpdateProductDto"], "price"> & { price?: number | null };
export type ProductVariantUpdateRequest = Omit<components["schemas"]["UpdateProductVariantDto"], "price"> & { price?: number | null };
