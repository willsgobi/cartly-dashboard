import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireActiveCompany } from "../../../lib/companies/active-request";
import { assertSameOrigin, noStore } from "../../../lib/auth/security";
import { authenticatedErrorResponse } from "../../../lib/auth/handlers";
import { readJsonInput } from "../../../lib/api/read-json";
import { ApiError } from "../../../lib/api/errors";
import { updateCompanySchema, updateAddressSchema } from "./schemas";
import { getCompanyDetails, updateCompanyAddress, updateCompanyInformation } from "./service";

export async function handleCompanySettings(request: NextRequest, companyId: string, addressId?: string) {
  try {
    if (request.method !== "GET") assertSameOrigin(request);
    const { token, company } = await requireActiveCompany(request);
    if (company.id !== companyId) throw new ApiError("http", { status: 403 });
    if (request.method === "GET" && addressId === undefined) return noStore(NextResponse.json(await getCompanyDetails(token, companyId, request.signal)));
    if (request.method !== "PATCH") throw new ApiError("http", { status: 405 });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("http", { status: 415 });
    const input = await readJsonInput(request);
    if (addressId !== undefined) {
      const parsed = updateAddressSchema.safeParse(input);
      if (!parsed.success) throw new ApiError("http", { status: 400 });
      const details = await getCompanyDetails(token, companyId, request.signal);
      if (!details.addresses.some((address) => address.id === addressId)) throw new ApiError("http", { status: 404 });
      return noStore(NextResponse.json(await updateCompanyAddress(token, companyId, addressId, parsed.data, request.signal)));
    }
    const parsed = updateCompanySchema.safeParse(input);
    if (!parsed.success) throw new ApiError("http", { status: 400 });
    return noStore(NextResponse.json(await updateCompanyInformation(token, companyId, parsed.data, request.signal)));
  } catch (error) { return authenticatedErrorResponse(error, "/dashboard/settings/company"); }
}
