import type { NextRequest } from "next/server";
import { handleCategories } from "../../../../features/categories/handlers";

async function handle(request: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
  return handleCategories(request, (await context.params).categoryId);
}
export const PATCH = handle;
export const DELETE = handle;
