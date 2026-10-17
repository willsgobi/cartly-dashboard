import { z } from "zod";
import type { components } from "../../../lib/api/generated/schema";

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  function digit(length: number) {
    let sum = 0;
    let weight = length - 7;
    for (let index = 0; index < length; index++) {
      sum += Number(value[index]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

export const cnpjSchema = z.string().trim().regex(/^[\d./\s-]+$/, "Informe um CNPJ válido.")
  .transform(digitsOnly).refine(isValidCnpj, "Informe um CNPJ válido com 14 dígitos.");
export const zipCodeSchema = z.string().trim().regex(/^[\d.\s-]+$/, "Informe um CEP válido.")
  .transform(digitsOnly).refine((value) => /^\d{8}$/.test(value), "Informe um CEP com 8 dígitos.");
const required = (message: string) => z.string().trim().min(1, message);

export const createCompanySchema = z.object({
  document: cnpjSchema,
  name: required("Informe a razão social."),
  address: z.object({
    zipCode: zipCodeSchema, street: required("Informe o logradouro."),
    number: required("Informe o número."), city: required("Informe a cidade."),
    state: required("Informe o estado."), country: required("Informe o país."),
  }),
});
export type CompanyFormValues = z.input<typeof createCompanySchema>;
export type CreateCompany = components["schemas"]["CreateCompanyDto"];

export const lookupFieldsSchema = z.object({
  name: z.string().optional(), "address.street": z.string().optional(),
  "address.number": z.string().optional(), "address.city": z.string().optional(),
  "address.state": z.string().optional(), "address.zipCode": z.string().optional(),
  "address.country": z.string().optional(),
});
export const lookupFieldNames = ["name", "address.street", "address.number", "address.city", "address.state", "address.zipCode", "address.country"] as const;
export type LookupField = typeof lookupFieldNames[number];
export type LookupFields = z.infer<typeof lookupFieldsSchema>;
export type LookupKind = "cnpj" | "cep";
export const creationResultSchema = z.object({ created: z.literal(true), active: z.boolean(), companyId: z.string() });
export type CreationResult = z.infer<typeof creationResultSchema>;
