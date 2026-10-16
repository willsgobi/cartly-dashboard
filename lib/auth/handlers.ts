import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "../api/client";
import { getApiBaseUrl } from "../api/environment";
import { ApiError } from "../api/errors";
import { checkSessionAccess } from "./authenticated-api";
import { loginInputSchema, decodeLoginResponse } from "./schemas";
import { clearSessionCookie, SessionError, sessionCookieName, setSessionCookie } from "./session";
import { assertSameOrigin, loginLocation, loginRedirect, noStore, safeReturnTo } from "./security";

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

/** Bound memory use even when Content-Length is missing or incorrect. */
async function readLoginInput(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("request");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16_384) {
        await reader.cancel();
        throw new ApiError("request");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data: unknown = JSON.parse(text);
    return data;
  } catch {
    throw new ApiError("request");
  } finally {
    reader.releaseLock();
  }
}

export async function handleLogin(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      throw new ApiError("http", { status: 415 });
    }
    const parsed = loginInputSchema.safeParse(await readLoginInput(request));
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
    setSessionCookie(response, result.accessToken);
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
