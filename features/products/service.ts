import "server-only";
import { authenticatedRequest } from "../../lib/auth/authenticated-api";
import { ApiError } from "../../lib/api/errors";
import { decodeProduct, decodeProducts, variantSchema, type ProductCreate, type ProductUpdate, type VariantCreate, type VariantUpdate } from "./schemas";

function decode<T>(read: () => T): T { try { return read(); } catch { throw new ApiError("invalid-response"); } }
export async function listProducts(token: string, companyId: string, signal?: AbortSignal) {
  const data = await authenticatedRequest(token, "GET", "/products", { query: { companyId }, signal });
  return decode(() => decodeProducts(data, companyId));
}
export async function getProduct(token: string, companyId: string, productId: string, signal?: AbortSignal) {
  const data = await authenticatedRequest(token, "GET", "/products/{productId}", { pathParams: { productId }, query: { companyId }, signal });
  return decode(() => decodeProduct(data, companyId, productId));
}
export async function createProduct(token: string, companyId: string, body: ProductCreate, signal?: AbortSignal) {
  const data = await authenticatedRequest(token, "POST", "/products", { body: { ...body, companyId }, signal });
  return decode(() => decodeProduct(data, companyId));
}
export async function updateProduct(token: string, companyId: string, productId: string, body: ProductUpdate, signal?: AbortSignal) {
  const data = await authenticatedRequest(token, "PATCH", "/products/{productId}", { pathParams: { productId }, body: { ...body, companyId }, signal });
  return decode(() => decodeProduct(data, companyId, productId));
}
export async function deleteProduct(token: string, companyId: string, productId: string, signal?: AbortSignal): Promise<void> {
  // DELETE's success body has only an example in Swagger. Do not infer a required envelope.
  await authenticatedRequest(token, "DELETE", "/products/{productId}", { pathParams: { productId }, body: { companyId }, signal });
}

export async function createVariant(token: string, companyId: string, productId: string, body: VariantCreate, signal?: AbortSignal) {
  const data = await authenticatedRequest(token, "POST", "/products/{productId}/variants", { pathParams: { productId }, query: { companyId }, body, signal });
  return decode(() => {
    const variant = variantSchema.parse(data);
    if (variant.productId !== undefined && variant.productId !== productId) throw new Error("Unexpected variant parent");
    return variant;
  });
}

export async function deleteVariant(token: string, companyId: string, productId: string, variantId: string, signal?: AbortSignal): Promise<void> {
  await authenticatedRequest(token, "DELETE", "/products/{productId}/variants/{variantId}", { pathParams: { productId, variantId }, query: { companyId }, signal });
}

export async function updateVariant(token: string, companyId: string, productId: string, variantId: string, body: VariantUpdate, signal?: AbortSignal) {
  const data = await authenticatedRequest(token, "PATCH", "/products/{productId}/variants/{variantId}", { pathParams: { productId, variantId }, query: { companyId }, body, signal });
  return decode(() => {
    const variant = variantSchema.parse(data);
    if (variant.id !== variantId || (variant.productId !== undefined && variant.productId !== productId)) throw new Error("Unexpected variant scope");
    return variant;
  });
}
