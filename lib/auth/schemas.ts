import "server-only";
import { z } from "zod";
import type { components } from "../api/generated/schema";

export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  returnTo: z.string().optional(),
});

const safeUserSchema = z.object({
    id: z.string(), name: z.string(), email: z.string(),
    lockedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
});

const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: safeUserSchema,
});

export function decodeSafeUserResponse(value: unknown): components["schemas"]["SafeUserResponseDto"] {
  return safeUserSchema.parse(value);
}

const messageSchema = z.object({ message: z.string() });

export function decodeMessageResponse(value: unknown): components["schemas"]["GenericMessageResponseDto"] {
  return messageSchema.parse(value);
}

export function decodeLoginResponse(value: unknown): components["schemas"]["LoginResponseDto"] {
  return loginResponseSchema.parse(value);
}

const companyListSchema = z.array(z.object({
  id: z.string(), name: z.string(), document: z.string(),
  createdAt: z.string(), updatedAt: z.string(),
}));

/** Authentication probe only; F03 does not expose or persist company data. */
export function decodeSessionProbe(value: unknown): components["schemas"]["CompanyListResponseDto"][] {
  return companyListSchema.parse(value);
}
