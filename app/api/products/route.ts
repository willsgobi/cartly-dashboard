import type { NextRequest } from "next/server";
import { handleProducts } from "../../../features/products/handlers";
export async function GET(request: NextRequest) { return handleProducts(request); }
export async function POST(request: NextRequest) { return handleProducts(request); }
