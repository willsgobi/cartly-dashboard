import type { NextRequest } from "next/server";
import { handleCompanySettings } from "@/features/companies/settings/handlers";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/companies/[companyId]/address/[addressId]">) {
  const { companyId, addressId } = await context.params;
  return handleCompanySettings(request, companyId, addressId);
}
