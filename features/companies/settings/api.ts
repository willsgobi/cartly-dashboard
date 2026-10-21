import { browserRequest } from "../../../lib/api/browser-request";
import { ApiError } from "../../../lib/api/errors";
import { addressSchema, decodeCompanyDetails, type CompanyUpdate, type AddressUpdate } from "./schemas";

const returnTo = "/dashboard/settings/company";
function path(companyId: string, addressId?: string) {
  return `/api/companies/${encodeURIComponent(companyId)}${addressId === undefined ? "" : `/address/${encodeURIComponent(addressId)}`}?${new URLSearchParams({ companyId })}`;
}
function checked<T>(read: () => T): T { try { return read(); } catch { throw new ApiError("invalid-response"); } }
export async function fetchCompanyDetails(companyId: string, signal: AbortSignal) {
  const data = await browserRequest(path(companyId), "GET", returnTo, undefined, signal);
  return checked(() => decodeCompanyDetails(data, companyId));
}
export async function saveCompanyInformation(companyId: string, body: CompanyUpdate, signal: AbortSignal) {
  const data = await browserRequest(path(companyId), "PATCH", returnTo, body, signal);
  return checked(() => decodeCompanyDetails(data, companyId));
}
export async function saveCompanyAddress(companyId: string, addressId: string, body: AddressUpdate, signal: AbortSignal) {
  const data = await browserRequest(path(companyId, addressId), "PATCH", returnTo, body, signal);
  return checked(() => { const address = addressSchema.parse(data); if (address.id !== addressId) throw new Error("Unexpected address ID"); return address; });
}
export function settingsError(error: unknown, operation?: "company"): string {
  if (operation === "company" && error instanceof ApiError && error.status === 409) return "Este CNPJ já está cadastrado em outra empresa.";
  if (error instanceof ApiError && error.status === 404) return "Empresa ou endereço não encontrado ou indisponível para sua conta.";
  return error instanceof ApiError ? error.message : "Não foi possível concluir a solicitação. Tente novamente.";
}
