import { z } from "zod";
import type { components } from "./generated/schema";

export type Company = components["schemas"]["CompanyListResponseDto"];
const companiesSchema = z.array(z.object({
  id: z.string(), name: z.string(), document: z.string(),
  createdAt: z.string(), updatedAt: z.string(),
}));

export function decodeCompanyList(value: unknown): Company[] {
  return companiesSchema.parse(value);
}
