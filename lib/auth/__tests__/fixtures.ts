import type { components } from "../../api/generated/schema";

/** Synthetic tokens only. Signature validity is decided by the mocked backend. */
export function testJwt(exp: unknown = Math.floor(Date.now() / 1000) + 300, alg = "HS256"): string {
  return [
    Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: "test-user", exp })).toString("base64url"),
    Buffer.from("synthetic-signature").toString("base64url"),
  ].join(".");
}

export const safeUser: components["schemas"]["SafeUserResponseDto"] = {
  id: "test-user", name: "Pessoa de teste", email: "test@example.com",
  lockedAt: null, createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z",
};

export const credentials = { email: "test@example.com", password: "synthetic-password" };
export const appOrigin = "http://dashboard.example.test";
