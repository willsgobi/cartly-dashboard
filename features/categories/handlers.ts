import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticatedRequest } from "../../lib/auth/authenticated-api";
import { authenticatedErrorResponse } from "../../lib/auth/handlers";
import { requireSessionToken, sessionCookieName } from "../../lib/auth/session";
import { assertSameOrigin, noStore } from "../../lib/auth/security";
import { companyCookieName, resolveActiveCompany } from "../../lib/companies/selection";
import { decodeCompanyList } from "../../lib/api/companies";
import { ApiError } from "../../lib/api/errors";
import { readJsonInput } from "../../lib/api/read-json";
import { categoryFormSchema, updateCategorySchema } from "./schemas";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./service";

/** Fixed category operations only. The cookie is a hint; verify membership on every request. */
export async function handleCategories(request: NextRequest, categoryId?: string): Promise<NextResponse> {
  try {
    if (request.method !== "GET") assertSameOrigin(request);
    const token = requireSessionToken(request.cookies.get(sessionCookieName())?.value);
    const companies = await authenticatedRequest(token, "GET", "/companies", { signal: request.signal, decode: decodeCompanyList });
    if (!companies) throw new ApiError("invalid-response");
    const company = resolveActiveCompany(companies, token, request.cookies.get(companyCookieName())?.value);
    // The browser sends its rendered scope only as a stale-document check, never as authorization.
    if (!company || request.nextUrl.searchParams.get("companyId") !== company.id) throw new ApiError("http", { status: 403 });
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
