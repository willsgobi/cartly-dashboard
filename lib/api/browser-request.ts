import { ApiError } from "./errors";

/** Same-origin BFF transport only; NestJS transport and JWT forwarding stay on the server. */
export async function browserRequest(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", returnTo: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method, signal, credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new ApiError(signal?.aborted ? "aborted" : "network"); }
  if (!response.ok) {
    if (response.status === 401) window.location.replace(`/login?reason=expired&returnTo=${encodeURIComponent(returnTo)}`);
    throw new ApiError("http", { status: response.status });
  }
  if (response.status === 204) return undefined;
  try { const data: unknown = await response.json(); return data; }
  catch { throw new ApiError(signal?.aborted ? "aborted" : "invalid-response"); }
}
