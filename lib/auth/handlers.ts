import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "../api/client";
import { getApiBaseUrl } from "../api/environment";
import { ApiError } from "../api/errors";
import { checkSessionAccess } from "./authenticated-api";
import { loginInputSchema, decodeLoginResponse } from "./schemas";
import { clearSessionCookie, SessionError, sessionCookieName, setSessionCookie } from "./session";
import { assertSameOrigin, loginLocation, loginRedirect, noStore, safeReturnTo } from "./security";
import { clearCompanySelection } from "../companies/selection";
import { readJsonInput } from "../api/read-json";

function errorResponse(error: unknown, login = false, redirectTo?: string): NextResponse {
  const failure = error instanceof ApiError ? error : new ApiError("invalid-response");
  const status = failure.kind === "http" ? (failure.status ?? 500)
    : failure.kind === "configuration" ? 503
    : failure.kind === "request" ? 400 : 502;
  const message = login && status === 401 ? "E-mail ou senha inválidos." : failure.message;
  return noStore(NextResponse.json({ error: { kind: failure.kind, message, status }, ...(redirectTo ? { redirectTo } : {}) }, { status }));
}

/** Use at every authenticated Route Handler boundary; never serialize ApiError.details. */
export function authenticatedErrorResponse(error: unknown, returnTo: unknown = "/dashboard"): NextResponse {
  if (error instanceof ApiError && error.status === 401) {
    const sessionError = error instanceof SessionError ? error : new SessionError("invalid");
    const response = errorResponse(sessionError, false, loginLocation(returnTo, sessionError.reason !== "missing"));
    clearSessionCookie(response);
    return response;
  }
  return errorResponse(error);
}

export async function handleLogin(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      throw new ApiError("http", { status: 415 });
    }
    const parsed = loginInputSchema.safeParse(await readJsonInput(request));
    if (!parsed.success) {
      return noStore(NextResponse.json({
        error: { kind: "request", message: "Informe um e-mail válido e sua senha.", status: 400 },
      }, { status: 400 }));
    }
    const { email, password, returnTo } = parsed.data;
    const api = createApiClient({ baseUrl: getApiBaseUrl() });
    const result = await api.request("POST", "/auth/login", {
      body: { email, password }, signal: request.signal, decode: decodeLoginResponse,
    });
    if (!result) throw new ApiError("invalid-response");
    const response = noStore(NextResponse.json({ user: result.user, returnTo: safeReturnTo(returnTo) }));
    setSessionCookie(response, result.accessToken, result.user);
    clearCompanySelection(response);
    return response;
  } catch (error) {
    return errorResponse(error, true);
  }
}

export async function handleLogout(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const response = loginRedirect("/dashboard");
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleSession(request: NextRequest): Promise<NextResponse> {
  const access = await checkSessionAccess(request.cookies.get(sessionCookieName())?.value, request.signal);
  if (access.kind === "authenticated") return noStore(NextResponse.json({ authenticated: true }));
  if (access.kind === "unauthenticated") {
    return authenticatedErrorResponse(new SessionError(access.expired ? "invalid" : "missing"), request.nextUrl.searchParams.get("returnTo"));
  }
  return authenticatedErrorResponse(access.error);
}
