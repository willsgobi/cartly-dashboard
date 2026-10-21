import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticatedRequest } from "../../lib/auth/authenticated-api";
import { authenticatedErrorResponse } from "../../lib/auth/handlers";
import { clearSessionCookie, sessionCookieName } from "../../lib/auth/session";
import { assertSameOrigin, getAppOrigin, loginRedirect, noStore } from "../../lib/auth/security";
import { ApiError } from "../../lib/api/errors";
import { decodeCompanyList } from "../../lib/api/companies";
import { clearCompanySelection, setCompanySelection } from "../../lib/companies/selection";
import { companySelectionSchema } from "./schemas";

function dashboardRedirect(error?: "invalid" | "denied" | "unavailable") {
  return noStore(NextResponse.redirect(new URL(error ? `/select-company?companyError=${error}` : "/dashboard", getAppOrigin()), 303));
}

export async function handleCompanySelection(request: NextRequest): Promise<NextResponse> {
  try { assertSameOrigin(request); } catch (error) { return authenticatedErrorResponse(error); }
  const token = request.cookies.get(sessionCookieName())?.value;
  try {
    const data = await request.formData();
    const parsed = companySelectionSchema.safeParse({ companyId: data.get("companyId") });
    if (!parsed.success) return dashboardRedirect("invalid");
    const companies = await authenticatedRequest(token, "GET", "/companies", { signal: request.signal, decode: decodeCompanyList });
    if (!companies) throw new ApiError("invalid-response");
    if (!companies.some((company) => company.id === parsed.data.companyId)) {
      const response = dashboardRedirect("invalid");
      clearCompanySelection(response);
      return response;
    }
    const response = dashboardRedirect();
    if (!token) throw new ApiError("http", { status: 401 });
    setCompanySelection(response, token, parsed.data.companyId);
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const response = loginRedirect("/dashboard", !!token);
      clearSessionCookie(response);
      return response;
    }
    return dashboardRedirect(error instanceof ApiError && error.status === 403 ? "denied" : "unavailable");
  }
}
