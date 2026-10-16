import "server-only";
import { createApiClient } from "../api/client";
import { getApiBaseUrl } from "../api/environment";
import { ApiError } from "../api/errors";
import type { ApiPath, ApiRequestOptions, ApiSuccessBody, HttpMethod, ResponseDecoder } from "../api/types";
import { requireSessionToken, SessionError } from "./session";
import { decodeSessionProbe } from "./schemas";

type AuthOptions<Method extends HttpMethod, Path extends ApiPath<Method>> =
  ApiRequestOptions<Method, Path> & { token?: never };

export function authenticatedRequest<Method extends HttpMethod, Path extends ApiPath<Method>>(
  token: string | undefined, method: Method, path: Path,
  options: AuthOptions<Method, Path> & { decode: ResponseDecoder<ApiSuccessBody<Method, Path>> },
): Promise<ApiSuccessBody<Method, Path> | undefined>;
export function authenticatedRequest<Method extends HttpMethod, Path extends ApiPath<Method>>(
  token: string | undefined, method: Method, path: Path, options: AuthOptions<Method, Path>,
): Promise<unknown>;
export async function authenticatedRequest<Method extends HttpMethod, Path extends ApiPath<Method>>(
  token: string | undefined, method: Method, path: Path,
  options: AuthOptions<Method, Path> & { decode?: ResponseDecoder<ApiSuccessBody<Method, Path>> },
): Promise<unknown> {
  const accessToken = requireSessionToken(token);
  const api = createApiClient({ baseUrl: getApiBaseUrl() });
  if (options.decode) {
    return api.request(method, path, { ...options, token: accessToken, decode: options.decode });
  }
  return api.request(method, path, { ...options, token: accessToken });
}

export type SessionAccess =
  | { kind: "authenticated" }
  | { kind: "unauthenticated"; expired: boolean }
  | { kind: "denied"; error: ApiError }
  | { kind: "unavailable"; error: ApiError };

/** Never infer validity from claims alone or invent an introspection endpoint. */
export async function checkSessionAccess(token: string | undefined, signal?: AbortSignal): Promise<SessionAccess> {
  try {
    const result = await authenticatedRequest(token, "GET", "/companies", { signal, decode: decodeSessionProbe });
    if (result === undefined) throw new ApiError("invalid-response");
    return { kind: "authenticated" };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { kind: "unauthenticated", expired: !(error instanceof SessionError && error.reason === "missing") };
    }
    const failure = error instanceof ApiError ? error : new ApiError("invalid-response");
    return { kind: failure.status === 403 ? "denied" : "unavailable", error: failure };
  }
}
