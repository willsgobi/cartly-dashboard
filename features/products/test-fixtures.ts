import type { Product } from "./schemas";
/** Synthetic API data, imported by automated tests only. */
export const product: Product = { id: "p", name: "Suco", description: "Natural", companyId: "a", categoryId: "cat", category: { id: "cat", name: "Bebidas" }, type: "NORMAL", price: 12.5, variants: [], createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" };
export const categories = [{ id: "cat", name: "Bebidas", companyId: "a", createdAt: product.createdAt, updatedAt: product.updatedAt }];
export const company = { id: "a", name: "Empresa", document: "a", createdAt: product.createdAt, updatedAt: product.updatedAt };
