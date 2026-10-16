import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkSessionAccess } from "./authenticated-api";
import { sessionCookieName } from "./session";
import { loginLocation } from "./security";

/** Check at the rendering/data boundary; Proxy's cookie check is only optimistic. */
export async function requireDashboardAccess() {
  const cookieStore = await cookies();
  const access = await checkSessionAccess(cookieStore.get(sessionCookieName())?.value);
  if (access.kind === "unauthenticated") redirect(loginLocation("/dashboard", access.expired));
  return access;
}
