import type { NextRequest } from "next/server";
import { handleCompanySettings } from "@/features/companies/settings/handlers";

export async function GET(request: NextRequest, context: RouteContext<"/api/companies/[companyId]">) {
  return handleCompanySettings(request, (await context.params).companyId);
}
export async function PATCH(request: NextRequest, context: RouteContext<"/api/companies/[companyId]">) {
  return handleCompanySettings(request, (await context.params).companyId);
}
