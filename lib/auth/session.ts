import "server-only";
import type { NextResponse } from "next/server";
import { ApiError } from "../api/errors";

export class SessionError extends ApiError {
  constructor(readonly reason: "missing" | "expired" | "invalid") {
    super("http", { status: 401 });
    this.name = "SessionError";
    this.message = reason === "missing"
      ? "Entre na sua conta para continuar."
      : "Sua sessão expirou. Entre novamente.";
  }
}

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-cartly_session" : "cartly_session";
}

/** Decode expiry only. NestJS remains responsible for signature and authorization. */
export function getJwtExpiration(token: string): number | undefined {
  if (token.length > 3800 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return undefined;
  try {
    const [headerPart, payloadPart] = token.split(".");
    const header: unknown = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    const payload: unknown = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (
      typeof header !== "object" || header === null ||
      !("alg" in header) || typeof header.alg !== "string" ||
      !header.alg || header.alg.toLowerCase() === "none" ||
      typeof payload !== "object" || payload === null ||
      !("exp" in payload) || typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) || payload.exp <= 0 || payload.exp * 1000 > 8.64e15
    ) return undefined;
    return payload.exp;
  } catch {
    return undefined;
  }
}

export function requireSessionToken(token: string | undefined): string {
  if (!token) throw new SessionError("missing");
  const exp = getJwtExpiration(token);
  if (exp === undefined) throw new SessionError("invalid");
  if (exp * 1000 <= Date.now()) throw new SessionError("expired");
  return token;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  } satisfies { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string };
}

export function setSessionCookie(response: NextResponse, token: string): void {
  const exp = getJwtExpiration(token);
  const now = Date.now();
  if (exp === undefined || Math.floor(exp - now / 1000) <= 0) throw new ApiError("invalid-response");
  response.cookies.set(sessionCookieName(), token, {
    ...cookieOptions(),
    expires: new Date(exp * 1000),
    maxAge: Math.floor(exp - now / 1000),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(sessionCookieName(), "", {
    ...cookieOptions(), maxAge: 0, expires: new Date(0),
  });
}
