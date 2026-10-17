import { z } from "zod";
import type { components } from "../../lib/api/generated/schema";

export type Category = components["schemas"]["CategoryResponseDto"];
export type CreateCategory = components["schemas"]["CreateCategoryDto"];
export type UpdateCategory = components["schemas"]["UpdateCategoryDto"];

export const categoryFormSchema = z.object({ name: z.string().trim().min(1, "Informe o nome da categoria.") });
export const updateCategorySchema = categoryFormSchema.partial();
export const categorySchema: z.ZodType<Category> = z.object({
  id: z.string(), name: z.string(), companyId: z.string(),
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
});

export function decodeCategory(value: unknown): Category { return categorySchema.parse(value); }
export function decodeCategories(value: unknown): Category[] { return z.array(categorySchema).parse(value); }
