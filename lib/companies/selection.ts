import "server-only";
import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { z } from "zod";
import type { Company } from "../api/companies";

export function companyCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-cartly_company" : "cartly_company";
}

const preferenceSchema = z.object({ session: z.string(), companyId: z.string() });
const sessionKey = (token: string) => createHash("sha256").update(token).digest("hex");
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" } as const);

/** Untrusted preference only. Always supply a freshly verified accessible company list. */
export function resolveActiveCompany(companies: Company[], token: string, preference?: string): Company | null {
  if (companies.length === 1) return companies[0];
  if (!preference || preference.length > 3800) return null;
  try {
    const parsed = preferenceSchema.safeParse(JSON.parse(preference));
    if (!parsed.success || parsed.data.session !== sessionKey(token)) return null;
    return companies.find((company) => company.id === parsed.data.companyId) ?? null;
  } catch {
    return null;
  }
}

export function setCompanySelection(response: NextResponse, token: string, companyId: string): void {
  // Session cookie persists through refresh. Login/logout/401 clear it; it contains no JWT.
  response.cookies.set(companyCookieName(), JSON.stringify({ session: sessionKey(token), companyId }), cookieOptions());
}

export function clearCompanySelection(response: NextResponse): void {
  response.cookies.set(companyCookieName(), "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
}
