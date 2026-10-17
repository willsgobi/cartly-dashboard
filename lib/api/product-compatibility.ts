import type { components } from "./generated/schema";

/** Explicit F10 compatibility: local NestJS DTOs accept number|null; Swagger says object.
 * Keep generated types untouched. See docs/frontend/modules/products.md for evidence/limits.
 */
export type ProductCreateRequest = Omit<components["schemas"]["CreateProductDto"], "price"> & { price?: number | null };
export type ProductUpdateRequest = Omit<components["schemas"]["UpdateProductDto"], "price"> & { price?: number | null };
