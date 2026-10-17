import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticatedRequest } from "../../../lib/auth/authenticated-api";
import { authenticatedErrorResponse } from "../../../lib/auth/handlers";
import { clearSessionCookie, requireSessionToken, sessionCookieName } from "../../../lib/auth/session";
import { assertSameOrigin, noStore } from "../../../lib/auth/security";
import { decodeCompanyList, decodeCreatedCompany } from "../../../lib/api/companies";
import { ApiError } from "../../../lib/api/errors";
import { readJsonInput } from "../../../lib/api/read-json";
import { clearCompanySelection, setCompanySelection } from "../../../lib/companies/selection";
import { createCompanySchema } from "./schemas";

export async function handleCreateCompany(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const token = requireSessionToken(request.cookies.get(sessionCookieName())?.value);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError("http", { status: 415 });
    const input = createCompanySchema.safeParse(await readJsonInput(request));
    if (!input.success) throw new ApiError("http", { status: 400 });
    const company = await authenticatedRequest(token, "POST", "/companies", { body: input.data, signal: request.signal, decode: decodeCreatedCompany });
    if (!company) throw new ApiError("invalid-response");

    // The mutation has committed. A failed list refresh must never replay creation.
    let active = false;
    let expired = false;
    try {
      const companies = await authenticatedRequest(token, "GET", "/companies", { signal: request.signal, decode: decodeCompanyList });
      active = companies?.some((item) => item.id === company.id) ?? false;
    } catch (error) { expired = error instanceof ApiError && error.status === 401; }
    const response = noStore(NextResponse.json({ created: true, active, companyId: company.id }, { status: 201 }));
    if (active) setCompanySelection(response, token, company.id);
    else clearCompanySelection(response);
    if (expired) clearSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return noStore(NextResponse.json({ error: { message: "Já existe uma empresa com este CNPJ.", status: 409 } }, { status: 409 }));
    }
    return authenticatedErrorResponse(error, "/dashboard/onboarding");
  }
}
