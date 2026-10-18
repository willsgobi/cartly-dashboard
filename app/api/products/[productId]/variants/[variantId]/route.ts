import type { NextRequest } from "next/server";
import { handleVariants } from "../../../../../../features/products/variant-handlers";
export async function DELETE(request: NextRequest, context: { params: Promise<{ productId: string; variantId: string }> }) { const { productId, variantId } = await context.params; return handleVariants(request, productId, variantId); }
export async function PATCH(request: NextRequest, context: { params: Promise<{ productId: string; variantId: string }> }) { const { productId, variantId } = await context.params; return handleVariants(request, productId, variantId); }
