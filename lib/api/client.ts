import { validateApiBaseUrl } from "./environment";
import { ApiError } from "./errors";
import { buildApiUrl } from "./url";
import type {
  ApiPath,
  ApiRequestOptions,
  ApiSuccessBody,
  HttpMethod,
  ResponseDecoder,
} from "./types";

export type ApiClientConfig = {
  baseUrl: string;
  /** Dependency injection for tests; defaults to native fetch. */
  fetch?: typeof globalThis.fetch;
};

type TransportOptions = {
  pathParams?: object;
  query?: object;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  decode?: ResponseDecoder<unknown>;
};

function transportError(error: unknown, signal?: AbortSignal, status?: number) {
  const aborted =
    signal?.aborted || (error instanceof Error && error.name === "AbortError");
  return new ApiError(aborted ? "aborted" : "network", { status });
}

function readErrorDetails(text: string): unknown {
  try {
    const details: unknown = JSON.parse(text);
    return details;
  } catch {
    return text || undefined;
  }
}

/** No shared token state, cookie forwarding, persistence or session side effects. */
export function createApiClient(config: ApiClientConfig) {
  const baseUrl = validateApiBaseUrl(config.baseUrl);
  const fetchRequest = config.fetch ?? globalThis.fetch;

  function request<Method extends HttpMethod, Path extends ApiPath<Method>>(
    method: Method,
    path: Path,
    options: ApiRequestOptions<Method, Path> & {
      decode: ResponseDecoder<ApiSuccessBody<Method, Path>>;
    },
  ): Promise<ApiSuccessBody<Method, Path> | undefined>;
  function request<Method extends HttpMethod, Path extends ApiPath<Method>>(
    method: Method,
    path: Path,
    options: ApiRequestOptions<Method, Path>,
  ): Promise<unknown>;
  async function request(
    method: HttpMethod,
    path: string,
    options: TransportOptions,
  ): Promise<unknown> {
    if (options.signal?.aborted) {
      throw new ApiError("aborted");
    }
    const url = buildApiUrl(baseUrl, path, options.pathParams, options.query);

    let headers: Headers;
    let body: string | undefined;
    try {
      headers = new Headers(options.headers);
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }
      if (options.token !== undefined) {
        if (!options.token.trim()) {
          throw new ApiError("request");
        }
        headers.set("Authorization", `Bearer ${options.token}`);
      }
      if (options.body !== undefined) {
        if (method === "GET") {
          throw new ApiError("request");
        }
        body = JSON.stringify(options.body);
        if (body === undefined) {
          throw new ApiError("request");
        }
        headers.set("Content-Type", "application/json");
      }
    } catch {
      throw new ApiError("request");
    }

    let response: Response;
    try {
      response = await fetchRequest(url, {
        method,
        headers,
        body,
        signal: options.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      });
    } catch (error) {
      throw transportError(error, options.signal);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new ApiError("aborted", { status: response.status });
      }
      if (!response.ok) {
        throw new ApiError("http", { status: response.status });
      }
      throw transportError(error, options.signal, response.status);
    }

    if (!response.ok) {
      throw new ApiError("http", {
        status: response.status,
        details: readErrorDetails(text),
      });
    }
    if (response.status === 204 || !text.trim()) {
      return undefined;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("invalid-response", { status: response.status });
    }

    if (!options.decode) {
      return data;
    }
    try {
      return options.decode(data);
    } catch {
      throw new ApiError("invalid-response", { status: response.status });
    }
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createApiClient>;
