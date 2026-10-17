import type { NextRequest } from "next/server";
import { handleLookup } from "../../../../features/companies/onboarding/lookup-handler";

export function POST(request: NextRequest) { return handleLookup(request, "cnpj"); }
