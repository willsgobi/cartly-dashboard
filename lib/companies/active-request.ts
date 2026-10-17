import "server-only";
import type { NextRequest } from "next/server";
import { authenticatedRequest } from "../auth/authenticated-api";
import { requireSessionToken, sessionCookieName } from "../auth/session";
import { decodeCompanyList } from "../api/companies";
import { ApiError } from "../api/errors";
import { companyCookieName, resolveActiveCompany } from "./selection";

/** Revalidate membership and compare the rendered scope to the server's active selection. */
export async function requireActiveCompany(request: NextRequest) {
  const token = requireSessionToken(request.cookies.get(sessionCookieName())?.value);
  const companies = await authenticatedRequest(token, "GET", "/companies", { signal: request.signal, decode: decodeCompanyList });
  if (!companies) throw new ApiError("invalid-response");
  const company = resolveActiveCompany(companies, token, request.cookies.get(companyCookieName())?.value);
  if (!company || request.nextUrl.searchParams.get("companyId") !== company.id) throw new ApiError("http", { status: 403 });
  return { token, company };
}
