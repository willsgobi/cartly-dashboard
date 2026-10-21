import "server-only";
import { authenticatedRequest } from "../../../lib/auth/authenticated-api";
import { ApiError } from "../../../lib/api/errors";
import { addressSchema, decodeCompanyDetails, type CompanyUpdate, type AddressUpdate } from "./schemas";

export async function getCompanyDetails(token: string, companyId: string, signal?: AbortSignal) {
  const result = await authenticatedRequest(token, "GET", "/companies/{companyId}", {
    pathParams: { companyId }, signal, decode: (value) => decodeCompanyDetails(value, companyId),
  });
  if (!result) throw new ApiError("invalid-response");
  return result;
}
export async function updateCompanyInformation(token: string, companyId: string, body: CompanyUpdate, signal?: AbortSignal) {
  const result = await authenticatedRequest(token, "PATCH", "/companies/{companyId}", {
    pathParams: { companyId }, body, signal, decode: (value) => decodeCompanyDetails(value, companyId),
  });
  if (!result) throw new ApiError("invalid-response");
  return result;
}
export async function updateCompanyAddress(token: string, companyId: string, addressId: string, body: AddressUpdate, signal?: AbortSignal) {
  const result = await authenticatedRequest(token, "PATCH", "/companies/{companyId}/address/{addressId}", {
    pathParams: { companyId, addressId }, body, signal,
    decode: (value) => { const address = addressSchema.parse(value); if (address.id !== addressId) throw new Error("Unexpected address ID"); return address; },
  });
  if (!result) throw new ApiError("invalid-response");
  return result;
}
