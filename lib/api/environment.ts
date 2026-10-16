import { ApiError } from "./errors";

/** Accept an absolute HTTP(S) URL, optionally including an API path prefix. */
export function validateApiBaseUrl(value: string | undefined): string {
  if (!value || !/^https?:\/\//i.test(value.trim())) {
    throw new ApiError("configuration");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ApiError("configuration");
  }

  if (
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw new ApiError("configuration");
  }

  return url.href.replace(/\/+$/, "") + "/";
}

/** Read lazily on the server; importing the API layer does not require configuration. */
export function getApiBaseUrl(): string {
  return validateApiBaseUrl(process.env.API_BASE_URL);
}
