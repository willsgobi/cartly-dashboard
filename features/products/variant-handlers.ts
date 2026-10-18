import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireActiveCompany } from "../../lib/companies/active-request";
import { authenticatedErrorResponse } from "../../lib/auth/handlers";
import { assertSameOrigin, noStore } from "../../lib/auth/security";
import { ApiError } from "../../lib/api/errors";
import { readJsonInput } from "../../lib/api/read-json";
import { createVariantSchema, updateVariantSchema, validProductState } from "./schemas";
import { createVariant, deleteVariant, getProduct, updateVariant } from "./service";

export async function handleVariants(request: NextRequest, productId: string, variantId?: string): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const { token, company } = await requireActiveCompany(request);
    const product = await getProduct(token, company.id, productId, request.signal);
    if (product.type === "NORMAL") throw new ApiError("http", { status: 400 });
    if (request.method === "POST" && variantId === undefined) {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("http", { status: 415 });
      const parsed = createVariantSchema.safeParse(await readJsonInput(request));
      if (!parsed.success || (product.type === "VARIANT" ? parsed.data.price !== null : parsed.data.price === null)) throw new ApiError("http", { status: 400 });
      return noStore(NextResponse.json(await createVariant(token, company.id, productId, parsed.data, request.signal), { status: 201 }));
    }
    if (request.method === "PATCH" && variantId) {
      const existing = product.variants.find((variant) => variant.id === variantId);
      if (!existing) throw new ApiError("http", { status: 404 });
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("http", { status: 415 });
      const parsed = updateVariantSchema.safeParse(await readJsonInput(request));
      if (!parsed.success || (product.type === "VARIANT" && parsed.data.price !== undefined)) throw new ApiError("http", { status: 400 });
      if (!validProductState({ ...product, variants: product.variants.map((variant) => variant.id === variantId ? { ...variant, ...parsed.data } : variant) })) throw new ApiError("http", { status: 400 });
      return noStore(NextResponse.json(await updateVariant(token, company.id, productId, variantId, parsed.data, request.signal)));
    }
    if (request.method === "DELETE" && variantId) {
      if (!product.variants.some((variant) => variant.id === variantId)) throw new ApiError("http", { status: 404 });
      // The inspected backend allows last-variant deletion. Do not claim an invariant guard.
      await deleteVariant(token, company.id, productId, variantId, request.signal);
      return noStore(NextResponse.json({ deleted: true }));
    }
    throw new ApiError("http", { status: 405 });
  } catch (error) { return authenticatedErrorResponse(error, "/dashboard/products"); }
}
