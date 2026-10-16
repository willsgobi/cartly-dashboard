import { ApiError } from "./errors";

function scalarToString(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return String(value);
  }
  throw new ApiError("request");
}

/** Arrays use repeated keys; absent/null values are omitted, empty strings are retained. */
export function serializeQuery(query: object = {}): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values: readonly unknown[] = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (entry !== undefined && entry !== null) {
        result.append(key, scalarToString(entry));
      }
    }
  }
  return result;
}

/** baseUrl has already been validated and normalized with a trailing slash. */
export function buildApiUrl(
  baseUrl: string,
  path: string,
  pathParams: object = {},
  query: object = {},
): URL {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\?#]/.test(path) ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new ApiError("request");
  }

  const parameters: Map<string, unknown> = new Map(Object.entries(pathParams));
  const resolvedPath = path.replace(/\{([^{}]+)\}/g, (_, name: string) => {
    const value = parameters.get(name);
    const segment = scalarToString(value);
    if (!segment || segment === "." || segment === "..") {
      throw new ApiError("request");
    }
    return encodeURIComponent(segment);
  });

  if (/[{}]/.test(resolvedPath)) {
    throw new ApiError("request");
  }

  const url = new URL(baseUrl + resolvedPath.slice(1));
  url.search = serializeQuery(query).toString();
  return url;
}
