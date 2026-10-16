import { z } from "zod";

export const companySelectionSchema = z.object({ companyId: z.string().min(1, "Selecione uma empresa.") });
export type CompanySelectionValues = z.infer<typeof companySelectionSchema>;
