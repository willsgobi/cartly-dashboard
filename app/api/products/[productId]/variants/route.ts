import type { NextRequest } from "next/server";
import { handleVariants } from "../../../../../features/products/variant-handlers";
export async function POST(request: NextRequest, context: { params: Promise<{ productId: string }> }) { return handleVariants(request, (await context.params).productId); }
