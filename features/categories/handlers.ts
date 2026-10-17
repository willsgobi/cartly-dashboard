import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticatedErrorResponse } from "../../lib/auth/handlers";
import { assertSameOrigin, noStore } from "../../lib/auth/security";
import { requireActiveCompany } from "../../lib/companies/active-request";
import { ApiError } from "../../lib/api/errors";
import { readJsonInput } from "../../lib/api/read-json";
import { categoryFormSchema, updateCategorySchema } from "./schemas";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./service";

/** Fixed category operations only. The cookie is a hint; verify membership on every request. */
export async function handleCategories(request: NextRequest, categoryId?: string): Promise<NextResponse> {
  try {
    if (request.method !== "GET") assertSameOrigin(request);
    const { token, company } = await requireActiveCompany(request);
    const method = request.method;
    if (method === "GET" && categoryId === undefined) return noStore(NextResponse.json(await listCategories(token, company.id, request.signal)));
    if (method === "DELETE" && categoryId) {
      await deleteCategory(token, company.id, categoryId, request.signal);
      return noStore(new NextResponse(null, { status: 204 }));
    }
    if ((method === "POST" && categoryId === undefined) || (method === "PATCH" && categoryId)) {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("http", { status: 415 });
      const parsed = (method === "POST" ? categoryFormSchema : updateCategorySchema).safeParse(await readJsonInput(request));
      if (!parsed.success) throw new ApiError("http", { status: 400 });
      if (method === "POST") {
        const body = categoryFormSchema.parse(parsed.data);
        return noStore(NextResponse.json(await createCategory(token, company.id, body, request.signal), { status: 201 }));
      }
      if (categoryId) return noStore(NextResponse.json(await updateCategory(token, company.id, categoryId, parsed.data, request.signal)));
    }
    throw new ApiError("http", { status: 405 });
  } catch (error) { return authenticatedErrorResponse(error, "/dashboard/categories"); }
}
