import { browserRequest } from "../../lib/api/browser-request";
import { ApiError } from "../../lib/api/errors";
import { decodeProduct, decodeProducts, variantSchema, type ProductCreate, type ProductUpdate, type VariantCreate, type VariantUpdate } from "./schemas";

function path(companyId: string, productId?: string) { return `/api/products${productId === undefined ? "" : `/${encodeURIComponent(productId)}`}?${new URLSearchParams({ companyId })}`; }
function checked<T>(read: () => T): T { try { return read(); } catch { throw new ApiError("invalid-response"); } }
export async function fetchProducts(companyId: string, signal: AbortSignal) {
  const data = await browserRequest(path(companyId), "GET", "/dashboard/products", undefined, signal);
  return checked(() => decodeProducts(data, companyId));
}
export async function fetchProduct(companyId: string, productId: string, signal: AbortSignal) {
  const data = await browserRequest(path(companyId, productId), "GET", "/dashboard/products", undefined, signal);
  return checked(() => decodeProduct(data, companyId, productId));
}
export async function saveProduct(companyId: string, body: ProductCreate | ProductUpdate, productId?: string, signal?: AbortSignal): Promise<void> {
  const data = await browserRequest(path(companyId, productId), productId === undefined ? "POST" : "PATCH", "/dashboard/products", body, signal);
  checked(() => decodeProduct(data, companyId, productId));
}
export async function removeProduct(companyId: string, productId: string, signal?: AbortSignal): Promise<void> {
  await browserRequest(path(companyId, productId), "DELETE", "/dashboard/products", undefined, signal);
}
export function productError(error: unknown): string { return error instanceof ApiError ? error.message : "Não foi possível concluir a ação. Tente novamente."; }

function variantPath(companyId: string, productId: string, variantId?: string) { return `/api/products/${encodeURIComponent(productId)}/variants${variantId === undefined ? "" : `/${encodeURIComponent(variantId)}`}?${new URLSearchParams({ companyId })}`; }
export async function addVariant(companyId: string, productId: string, body: VariantCreate, signal: AbortSignal): Promise<void> {
  const data = await browserRequest(variantPath(companyId, productId), "POST", "/dashboard/products", body, signal);
  checked(() => { const variant = variantSchema.parse(data); if (variant.productId !== undefined && variant.productId !== productId) throw new Error("Unexpected variant parent"); return variant; });
}
export async function removeVariant(companyId: string, productId: string, variantId: string, signal: AbortSignal): Promise<void> {
  await browserRequest(variantPath(companyId, productId, variantId), "DELETE", "/dashboard/products", undefined, signal);
}
export function variantError(error: unknown): string { return error instanceof ApiError && error.status === 409 ? "Já existe uma variante com este nome neste produto." : productError(error); }
export async function patchVariant(companyId: string, productId: string, variantId: string, body: VariantUpdate, signal: AbortSignal): Promise<void> {
  const data = await browserRequest(variantPath(companyId, productId, variantId), "PATCH", "/dashboard/products", body, signal);
  checked(() => { const variant = variantSchema.parse(data); if (variant.id !== variantId || (variant.productId !== undefined && variant.productId !== productId)) throw new Error("Unexpected variant scope"); return variant; });
}
