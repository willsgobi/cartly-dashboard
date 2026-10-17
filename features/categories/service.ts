import "server-only";
import { authenticatedRequest } from "../../lib/auth/authenticated-api";
import { ApiError } from "../../lib/api/errors";
import { decodeCategories, decodeCategory, type Category, type CreateCategory, type UpdateCategory } from "./schemas";

function verifyCategory(category: Category | undefined, companyId: string, categoryId?: string): Category {
  if (!category || category.companyId !== companyId || (categoryId !== undefined && category.id !== categoryId)) {
    throw new ApiError("invalid-response");
  }
  return category;
}

export async function listCategories(token: string, companyId: string, signal?: AbortSignal): Promise<Category[]> {
  const result = await authenticatedRequest(token, "GET", "/companies/{companyId}/categories", { pathParams: { companyId }, signal, decode: decodeCategories });
  if (!result) throw new ApiError("invalid-response");
  return result.map((category) => verifyCategory(category, companyId));
}

export async function createCategory(token: string, companyId: string, body: CreateCategory, signal?: AbortSignal) {
  return verifyCategory(await authenticatedRequest(token, "POST", "/companies/{companyId}/categories", { pathParams: { companyId }, body, signal, decode: decodeCategory }), companyId);
}

export async function updateCategory(token: string, companyId: string, categoryId: string, body: UpdateCategory, signal?: AbortSignal) {
  return verifyCategory(await authenticatedRequest(token, "PATCH", "/companies/{companyId}/categories/{categoryId}", { pathParams: { companyId, categoryId }, body, signal, decode: decodeCategory }), companyId, categoryId);
}

export async function deleteCategory(token: string, companyId: string, categoryId: string, signal?: AbortSignal): Promise<void> {
  await authenticatedRequest(token, "DELETE", "/companies/{companyId}/categories/{categoryId}", { pathParams: { companyId, categoryId }, signal });
}
