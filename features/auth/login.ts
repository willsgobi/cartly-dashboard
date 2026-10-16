import { z } from "zod";
import { ApiError } from "../../lib/api/errors";
import type { LoginFormValues } from "./schemas";

/** Same-origin BFF only. The server sets the cookie; JavaScript never receives a JWT. */
export async function login(values: LoginFormValues, returnTo: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...values, returnTo }),
    });
  } catch {
    throw new ApiError("network");
  }
  if (!response.ok) {
    throw new ApiError("http", { status: response.status });
  }
  // Only accept the destination already sanitized by the Server Component and BFF.
  // Untrusted error messages, user data and unexpected response properties are unused.
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("invalid-response");
  }
  if (!z.object({ returnTo: z.literal(returnTo) }).safeParse(body).success) {
    throw new ApiError("invalid-response");
  }
  // A document navigation starts protected rendering with the new cookie and no stale router cache.
  window.location.replace(returnTo);
}
