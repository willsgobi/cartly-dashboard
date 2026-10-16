import { NextResponse, type NextRequest } from "next/server";
import { checkSessionAccess } from "./lib/auth/authenticated-api";
import { clearSessionCookie, getJwtExpiration, sessionCookieName } from "./lib/auth/session";
import { loginRedirect, noStore } from "./lib/auth/security";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(sessionCookieName())?.value;
  const exp = token ? getJwtExpiration(token) : undefined;
  const locallyInvalid = !!token && (exp === undefined || exp * 1000 <= Date.now());
  const isLogin = request.nextUrl.pathname === "/login";
  const returnTo = request.nextUrl.pathname + request.nextUrl.search;

  if (!isLogin && (!token || locallyInvalid)) {
    const response = loginRedirect(returnTo, !!token);
    if (token) clearSessionCookie(response);
    return response;
  }

  const response = noStore(NextResponse.next());
  if (isLogin && token) {
    // Server Components cannot set cookies. A 401 redirects here for cleanup.
    // Recheck before clearing: a crafted URL or stale redirect must not log out a valid session.
    const invalidated = locallyInvalid || (
      request.nextUrl.searchParams.get("reason") === "expired" &&
      (await checkSessionAccess(token, request.signal)).kind === "unauthenticated"
    );
    if (invalidated) clearSessionCookie(response);
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/login"] };
