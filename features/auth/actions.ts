"use server";

import { headers } from "next/headers";
import { createApiClient } from "../../lib/api/client";
import { getApiBaseUrl } from "../../lib/api/environment";
import { ApiError } from "../../lib/api/errors";
import { assertSameOrigin } from "../../lib/auth/security";
import { decodeMessageResponse, decodeSafeUserResponse } from "../../lib/auth/schemas";
import { activationSchema, registerRequestSchema, resendSchema, resetPasswordRequestSchema, type AuthActionResult } from "./schemas";

function failure(error: unknown, operation: "register" | "activate" | "resend" | "forgot" | "reset"): AuthActionResult {
  if (error instanceof ApiError) {
    if (error.status === 409 && operation === "register") {
      return { ok: false, status: 409, message: "Este e-mail já está cadastrado. Entre na sua conta ou ative seu cadastro." };
    }
    if (error.status === 400) {
      return { ok: false, status: 400, message: operation === "activate" || operation === "reset"
        ? "Código inválido, expirado ou indisponível para uso. Confira os dados e tente novamente."
        : "Não foi possível concluir a solicitação. Confira os dados informados." };
    }
    if (operation === "forgot" && error.kind === "http") {
      return { ok: false, status: error.status, message: "Não foi possível enviar o código. Tente novamente." };
    }
    return { ok: false, status: error.status, message: error.message };
  }
  return { ok: false, message: "Não foi possível concluir a solicitação. Tente novamente." };
}

export async function requestPasswordReset(input: unknown): Promise<AuthActionResult> {
  try {
    assertSameOrigin({ headers: await headers() });
    const parsed = resendSchema.safeParse(input);
    if (!parsed.success) return { ok: false, status: 400, message: "Informe um e-mail válido para receber o código." };
    const api = createApiClient({ baseUrl: getApiBaseUrl() });
    const result = await api.request("POST", "/auth/forgot-password", { body: parsed.data, decode: decodeMessageResponse });
    if (!result) throw new ApiError("invalid-response");
    return { ok: true };
  } catch (error) {
    return failure(error, "forgot");
  }
}

export async function resetPassword(input: unknown): Promise<AuthActionResult> {
  try {
    assertSameOrigin({ headers: await headers() });
    const parsed = resetPasswordRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, status: 400, message: "Confira o e-mail, o código de 8 dígitos e a nova senha." };
    const api = createApiClient({ baseUrl: getApiBaseUrl() });
    const result = await api.request("POST", "/auth/reset-password", { body: parsed.data, decode: decodeSafeUserResponse });
    if (!result) throw new ApiError("invalid-response");
    return { ok: true };
  } catch (error) {
    return failure(error, "reset");
  }
}

export async function registerAccount(input: unknown): Promise<AuthActionResult> {
  try {
    assertSameOrigin({ headers: await headers() });
    const parsed = registerRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, status: 400, message: "Confira o nome, o e-mail e a senha informados." };
    const api = createApiClient({ baseUrl: getApiBaseUrl() });
    const result = await api.request("POST", "/auth/register", { body: parsed.data, decode: decodeSafeUserResponse });
    if (!result) throw new ApiError("invalid-response");
    return { ok: true };
  } catch (error) {
    return failure(error, "register");
  }
}

export async function activateAccount(input: unknown): Promise<AuthActionResult> {
  try {
    assertSameOrigin({ headers: await headers() });
    const parsed = activationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, status: 400, message: "Informe um e-mail válido e um código com exatamente 8 dígitos." };
    const api = createApiClient({ baseUrl: getApiBaseUrl() });
    const result = await api.request("POST", "/auth/activate-account", { body: parsed.data, decode: decodeSafeUserResponse });
    if (!result) throw new ApiError("invalid-response");
    return { ok: true };
  } catch (error) {
    return failure(error, "activate");
  }
}

export async function resendActivation(input: unknown): Promise<AuthActionResult> {
  try {
    assertSameOrigin({ headers: await headers() });
    const parsed = resendSchema.safeParse(input);
    if (!parsed.success) return { ok: false, status: 400, message: "Informe um e-mail válido para reenviar o código." };
    const api = createApiClient({ baseUrl: getApiBaseUrl() });
    const result = await api.request("POST", "/auth/resend-activation", { body: parsed.data, decode: decodeMessageResponse });
    if (!result) throw new ApiError("invalid-response");
    // Do not forward backend wording that could disclose account existence.
    return { ok: true };
  } catch (error) {
    return failure(error, "resend");
  }
}
