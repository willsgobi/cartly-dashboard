import { z } from "zod";
import { ApiError } from "../../../lib/api/errors";
import { creationResultSchema, lookupFieldsSchema, type CreateCompany, type LookupKind } from "./schemas";

async function post(path: string, signal?: AbortSignal, body?: CreateCompany): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(signal?.aborted ? "aborted" : "network");
  }
  if (!response.ok) {
    if (response.status === 401) window.location.replace("/login?reason=expired&returnTo=%2Fdashboard%2Fonboarding");
    throw new ApiError("http", { status: response.status });
  }
  try { const data: unknown = await response.json(); return data; }
  catch { throw new ApiError("invalid-response"); }
}

export async function lookupCompanyData(kind: LookupKind, value: string, signal: AbortSignal) {
  const data = await post(`/api/lookups/${kind}?value=${encodeURIComponent(value)}`, signal);
  const result = z.object({ fields: lookupFieldsSchema }).safeParse(data);
  if (!result.success) throw new ApiError("invalid-response");
  return result.data.fields;
}

export async function createCompany(values: CreateCompany) {
  const result = creationResultSchema.safeParse(await post("/api/companies", undefined, values));
  if (!result.success) throw new ApiError("invalid-response");
  if (result.data.active) window.location.replace("/dashboard");
  return result.data;
}
