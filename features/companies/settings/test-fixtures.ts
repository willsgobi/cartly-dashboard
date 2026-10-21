import type { CompanyDetails, CompanyAddress } from "./schemas";
export const companies = ["a", "b"].map((id) => ({ id, name: `Empresa ${id}`, document: "11222333000181", createdAt: "2026-10-20T12:00:00Z", updatedAt: "2026-10-20T12:00:00Z" }));
export const address: CompanyAddress = { id: "address-1", street: "Rua original", number: "001", city: "São Paulo", state: "SP", zipCode: "01001000", country: "Brazil", createdAt: companies[0].createdAt, updatedAt: companies[0].updatedAt };
export const details: CompanyDetails = { ...companies[0], addresses: [address, { ...address, id: "address-2", street: "Outra rua", number: "22" }] };
