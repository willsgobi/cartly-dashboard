import { z } from "zod";
import type { components } from "../../../lib/api/generated/schema";
import { zipCodeSchema, digitsOnly } from "../onboarding/schemas";

const required = (message: string) => z.string().trim().min(1, message);
export const companyInformationSchema = z.object({
  name: required("Informe a razão social."),
});
export const addressFormSchema = z.object({
  street: required("Informe a rua."), city: required("Informe a cidade."),
  state: required("Informe o estado."), zipCode: zipCodeSchema, country: required("Informe o país."),
});
export const updateCompanySchema = companyInformationSchema.partial().strict().refine((value) => Object.keys(value).length > 0);
export const updateAddressSchema = addressFormSchema.partial().strict().refine((value) => Object.keys(value).length > 0);
export type CompanyInformationValues = z.input<typeof companyInformationSchema>;
export type AddressValues = z.input<typeof addressFormSchema>;
// Dashboard policy: company documents are immutable, even though OpenAPI allows updates.
export type CompanyUpdate = Pick<components["schemas"]["UpdateCompanyDto"], "name">;
export type AddressUpdate = components["schemas"]["UpdateCompanyAddressDto"];
export type CompanyDetails = components["schemas"]["CompanyDetailsResponseDto"];
export type CompanyAddress = components["schemas"]["CompanyDetailAddressResponseDto"];
export const addressSchema = z.object({
  id: z.string().min(1), street: z.string(), number: z.string(), city: z.string(), state: z.string(),
  zipCode: z.string(), country: z.string(), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
});
const detailsSchema = z.object({
  id: z.string().min(1), name: z.string(), document: z.string(),
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }), addresses: z.array(addressSchema),
});
export function decodeCompanyDetails(value: unknown, companyId: string): CompanyDetails {
  const details = detailsSchema.parse(value);
  if (details.id !== companyId || new Set(details.addresses.map((address) => address.id)).size !== details.addresses.length) throw new Error("Unexpected company scope or duplicate address IDs");
  return details;
}
export function informationChanges(values: CompanyInformationValues, company: CompanyDetails): CompanyUpdate {
  const parsed = companyInformationSchema.parse(values);
  return {
    ...(parsed.name !== company.name.trim() ? { name: parsed.name } : {}),
  };
}
export const addressFields = ["zipCode", "street", "city", "state", "country"] as const;
export function addressValues(address: CompanyAddress): AddressValues {
  return { street: address.street, city: address.city, state: address.state, zipCode: address.zipCode, country: address.country };
}
export function addressChanges(values: AddressValues, address: CompanyAddress): AddressUpdate {
  const parsed = addressFormSchema.parse(values);
  const changes: AddressUpdate = {};
  for (const field of addressFields) {
    const before = field === "zipCode" ? digitsOnly(address[field]) : address[field].trim();
    if (parsed[field] !== before) changes[field] = parsed[field];
  }
  return changes;
}
