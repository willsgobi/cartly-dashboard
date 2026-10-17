import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { requireDashboardAccess } from "../../lib/auth/guard";
import { sessionCookieName } from "../../lib/auth/session";
import { displayUserCookieName, readDisplayUser } from "../../lib/auth/display-user";
import { companyCookieName, resolveActiveCompany } from "../../lib/companies/selection";

/** React request memoization only: layout and page share one authoritative guard/list read. */
export const getDashboardContext = cache(async () => {
  const access = await requireDashboardAccess();
  if (access.kind !== "authenticated") return access;
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value ?? "";
  return {
    ...access,
    activeCompany: resolveActiveCompany(access.companies, token, store.get(companyCookieName())?.value),
    user: readDisplayUser(token, store.get(displayUserCookieName())?.value),
  };
});
