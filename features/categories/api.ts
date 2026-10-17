import { ApiError } from "../../lib/api/errors";
import { browserRequest } from "../../lib/api/browser-request";
import { decodeCategories, decodeCategory, type CreateCategory, type UpdateCategory } from "./schemas";

async function request(companyId: string, method: "GET" | "POST" | "PATCH" | "DELETE", categoryId?: string, body?: CreateCategory | UpdateCategory, signal?: AbortSignal): Promise<unknown> {
  const path = `/api/categories${categoryId === undefined ? "" : `/${encodeURIComponent(categoryId)}`}?${new URLSearchParams({ companyId })}`;
  return browserRequest(path, method, "/dashboard/categories", body, signal);
}

export async function fetchCategories(companyId: string, signal: AbortSignal) {
  const data = await request(companyId, "GET", undefined, undefined, signal);
  try {
    const categories = decodeCategories(data);
    if (categories.some((category) => category.companyId !== companyId)) throw new Error("Unexpected company");
    return categories;
  } catch { throw new ApiError("invalid-response"); }
}

export async function saveCategory(companyId: string, body: CreateCategory, categoryId?: string, signal?: AbortSignal): Promise<void> {
  const data = await request(companyId, categoryId === undefined ? "POST" : "PATCH", categoryId, body, signal);
  try {
    const category = decodeCategory(data);
    if (category.companyId !== companyId || (categoryId !== undefined && category.id !== categoryId)) throw new Error("Unexpected category");
  } catch { throw new ApiError("invalid-response"); }
}

export async function removeCategory(companyId: string, categoryId: string, signal?: AbortSignal): Promise<void> {
  await request(companyId, "DELETE", categoryId, undefined, signal);
}

export function categoryErrorMessage(error: unknown, deleting = false): string {
  if (error instanceof ApiError && error.status === 409) return deleting
    ? "Não é possível excluir esta categoria porque existem produtos vinculados a ela."
    : "Já existe uma categoria com este nome nesta empresa.";
  return error instanceof ApiError ? error.message : "Não foi possível concluir a ação. Tente novamente.";
}
