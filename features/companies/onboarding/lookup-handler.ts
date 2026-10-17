import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkSessionAccess } from "../../../lib/auth/authenticated-api";
import { authenticatedErrorResponse } from "../../../lib/auth/handlers";
import { requireSessionToken, sessionCookieName, SessionError } from "../../../lib/auth/session";
import { assertSameOrigin, noStore } from "../../../lib/auth/security";
import { ApiError } from "../../../lib/api/errors";
import { cnpjSchema, digitsOnly, zipCodeSchema, type LookupFields, type LookupKind } from "./schemas";
import { lookupLimiters } from "./rate-limit";

const receitaSchema = z.object({
  status: z.literal("OK"), nome: z.string().trim().min(1), cnpj: z.string().optional(),
  logradouro: z.string().optional(), numero: z.string().optional(), municipio: z.string().optional(),
  uf: z.string().optional(), cep: z.string().optional(),
});
const viaCepSchema = z.object({
  cep: zipCodeSchema, logradouro: z.string(), localidade: z.string().min(1), uf: z.string().min(1),
  erro: z.union([z.boolean(), z.string()]).optional(),
});

function lookupError(kind: LookupKind, status = 502, retryAfter?: number) {
  const message = status === 429 ? "Limite de consultas atingido. Aguarde e tente novamente ou preencha manualmente."
    : kind === "cnpj" ? "Não foi possível consultar o CNPJ. Preencha os dados manualmente."
    : "CEP não encontrado ou indisponível. Informe o endereço manualmente.";
  const response = noStore(NextResponse.json({ error: { message, status } }, { status }));
  if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
  return response;
}

export async function handleLookup(request: NextRequest, kind: LookupKind): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const input = (kind === "cnpj" ? cnpjSchema : zipCodeSchema).safeParse(request.nextUrl.searchParams.get("value"));
    if (!input.success) return lookupError(kind, 400);
    const token = requireSessionToken(request.cookies.get(sessionCookieName())?.value);
    const access = await checkSessionAccess(token, request.signal);
    if (access.kind === "unauthenticated") throw new SessionError("invalid");
    if (access.kind !== "authenticated") return authenticatedErrorResponse(access.error, "/dashboard/onboarding");
    const retryAfter = lookupLimiters[kind].take();
    if (retryAfter) return lookupError(kind, 429, retryAfter);
    const url = kind === "cnpj" ? `https://receitaws.com.br/v1/cnpj/${input.data}` : `https://viacep.com.br/ws/${input.data}/json/`;
    const response = await fetch(url, {
      method: "GET", cache: "no-store", credentials: "omit", redirect: "error",
      headers: { Accept: "application/json" }, signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok) return lookupError(kind, response.status === 429 ? 429 : 502);
    const data: unknown = await response.json();
    let fields: LookupFields;
    if (kind === "cnpj") {
      const company = receitaSchema.safeParse(data);
      if (!company.success || (company.data.cnpj && digitsOnly(company.data.cnpj) !== input.data)) return lookupError(kind);
      const { nome, logradouro, numero, municipio, uf, cep } = company.data;
      fields = { name: nome, "address.street": logradouro, "address.number": numero, "address.city": municipio, "address.state": uf, "address.country": "Brazil" };
      const zip = zipCodeSchema.safeParse(cep);
      if (zip.success) fields["address.zipCode"] = zip.data;
    } else {
      const address = viaCepSchema.safeParse(data);
      if (!address.success || address.data.erro === true || address.data.erro === "true" || address.data.cep !== input.data) return lookupError(kind, 404);
      fields = { "address.street": address.data.logradouro, "address.city": address.data.localidade, "address.state": address.data.uf, "address.zipCode": address.data.cep };
    }
    return noStore(NextResponse.json({ fields }));
  } catch (error) {
    if (error instanceof ApiError) return authenticatedErrorResponse(error, "/dashboard/onboarding");
    return lookupError(kind);
  }
}
