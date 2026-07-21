import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isUniqueConstraint, jsonError } from "@/lib/api";
import { firstValidationError, productSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  const products = await db.product.findMany({ where: { userId: session.userId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  try {
    const body: unknown = await request.json();
    const result = productSchema.safeParse(body);
    if (!result.success) return jsonError(firstValidationError(result.error), 400, result.error.flatten());
    const product = await db.product.create({ data: { ...result.data, userId: session.userId } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraint(error)) return jsonError("That SKU already exists in your inventory", 409);
    return jsonError("We couldn't add the product. Please try again.", 500);
  }
}
