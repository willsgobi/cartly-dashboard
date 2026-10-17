import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireActiveCompany } from "../../lib/companies/active-request";
import { authenticatedErrorResponse } from "../../lib/auth/handlers";
import { assertSameOrigin, noStore } from "../../lib/auth/security";
import { ApiError } from "../../lib/api/errors";
import { readJsonInput } from "../../lib/api/read-json";
import { listCategories } from "../categories/service";
import { createProductSchema, updateProductSchema, validProductState } from "./schemas";
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from "./service";

export async function handleProducts(request: NextRequest, productId?: string): Promise<NextResponse> {
  try {
    if (request.method !== "GET") assertSameOrigin(request);
    const { token, company } = await requireActiveCompany(request);
    const signal = request.signal;
    if (request.method === "GET") return noStore(NextResponse.json(productId === undefined ? await listProducts(token, company.id, signal) : await getProduct(token, company.id, productId, signal)));
    if (request.method === "DELETE" && productId) {
      await deleteProduct(token, company.id, productId, signal);
      return noStore(NextResponse.json({ deleted: true }));
    }
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("http", { status: 415 });
    const input = await readJsonInput(request);
    if (request.method === "POST" && productId === undefined) {
      const parsed = createProductSchema.safeParse(input);
      if (!parsed.success) throw new ApiError("http", { status: 400 });
      const categories = await listCategories(token, company.id, signal);
      if (!categories.some((category) => category.id === parsed.data.categoryId)) throw new ApiError("http", { status: 404 });
      return noStore(NextResponse.json(await createProduct(token, company.id, parsed.data, signal), { status: 201 }));
    }
    if (request.method === "PATCH" && productId) {
      const parsed = updateProductSchema.safeParse(input);
      if (!parsed.success) throw new ApiError("http", { status: 400 });
      const existing = await getProduct(token, company.id, productId, signal);
      if (parsed.data.type !== undefined && parsed.data.type !== existing.type) throw new ApiError("http", { status: 400 });
      const categories = await listCategories(token, company.id, signal);
      if (!categories.some((category) => category.id === (parsed.data.categoryId ?? existing.categoryId))) throw new ApiError("http", { status: 404 });
      if (!validProductState({ ...existing, ...parsed.data })) throw new ApiError("http", { status: 400 });
      return noStore(NextResponse.json(await updateProduct(token, company.id, productId, parsed.data, signal)));
    }
    throw new ApiError("http", { status: 405 });
  } catch (error) { return authenticatedErrorResponse(error, "/dashboard/products"); }
}
