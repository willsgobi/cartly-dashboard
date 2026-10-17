import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { z } from "zod";

const displayUserSchema = z.object({ name: z.string(), email: z.string() });
export type DisplayUser = z.infer<typeof displayUserSchema>;
export const displayUserCookieName = () => process.env.NODE_ENV === "production" ? "__Host-cartly_user" : "cartly_user";
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" } as const);
const sign = (token: string, payload: string) => createHmac("sha256", token).update(`cartly-display-user:${payload}`).digest();

/** Display-only login DTO snapshot. This cookie never authenticates or authorizes a request. */
export function setDisplayUser(response: NextResponse, token: string, user: DisplayUser, expires: Date, maxAge: number) {
  const payload = Buffer.from(JSON.stringify(displayUserSchema.parse(user))).toString("base64url");
  const value = `${payload}.${sign(token, payload).toString("base64url")}`;
  if (value.length > 3800) { clearDisplayUser(response); return; }
  response.cookies.set(displayUserCookieName(), value, { ...options(), expires, maxAge });
}

export function readDisplayUser(token: string, value?: string): DisplayUser | null {
  if (!value || value.length > 3800) return null;
  try {
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const supplied = Buffer.from(signature, "base64url");
    const expected = sign(token, payload);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const result = displayUserSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return result.success ? result.data : null;
  } catch { return null; }
}

export function clearDisplayUser(response: NextResponse) {
  response.cookies.set(displayUserCookieName(), "", { ...options(), maxAge: 0, expires: new Date(0) });
}
