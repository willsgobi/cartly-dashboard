import { handleCategories } from "../../../features/categories/handlers";
import type { NextRequest } from "next/server";
export async function GET(request: NextRequest) { return handleCategories(request); }
export async function POST(request: NextRequest) { return handleCategories(request); }
