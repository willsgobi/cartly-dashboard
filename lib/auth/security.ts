import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "../api/errors";
import { validateApiBaseUrl } from "../api/environment";

export function getAppOrigin(): string {
  const url = new URL(validateApiBaseUrl(process.env.APP_ORIGIN));
  if (url.pathname !== "/") throw new ApiError("configuration");
  return url.origin;
}

/** Return destinations are restricted to dashboard/company selection, never auth or API routes. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || /[\\\u0000-\u0020]/.test(value) || !value.startsWith("/")) {
    return "/dashboard";
  }
  try {
    const url = new URL(value, "https://venduzily.invalid");
    if (url.origin !== "https://venduzily.invalid" || !/^(?:\/dashboard(?:\/[a-zA-Z0-9_-]+)*\/?|\/select-company)$/.test(url.pathname)) {
      return "/dashboard";
    }
    return url.pathname + url.search;
  } catch {
    return "/dashboard";
  }
}

export function loginLocation(returnTo: unknown, expired = false): string {
  const query = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
  if (expired) query.set("reason", "expired");
  return `/login?${query}`;
}

/** Use a configured origin, never the incoming Host or Forwarded headers. */
export function assertSameOrigin(request: { headers: Pick<Headers, "get"> }): void {
  const site = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== getAppOrigin() || (site !== null && site !== "same-origin")) {
    throw new ApiError("http", { status: 403 });
  }
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export function loginRedirect(returnTo: unknown, expired = false): NextResponse {
  return noStore(NextResponse.redirect(new URL(loginLocation(returnTo, expired), getAppOrigin()), 303));
}
