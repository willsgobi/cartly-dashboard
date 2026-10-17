import type { NextRequest } from "next/server";
import { handleProducts } from "../../../../features/products/handlers";
async function handle(request: NextRequest, context: { params: Promise<{ productId: string }> }) { return handleProducts(request, (await context.params).productId); }
export const GET = handle;
export const PATCH = handle;
export const DELETE = handle;
