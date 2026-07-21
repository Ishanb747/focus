import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isUniqueConstraint, jsonError } from "@/lib/api";
import { firstValidationError, productSchema } from "@/lib/validation";

interface RouteContext { params: { id: string } }

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  try {
    const body: unknown = await request.json();
    const result = productSchema.safeParse(body);
    if (!result.success) return jsonError(firstValidationError(result.error), 400, result.error.flatten());
    const existing = await db.product.findFirst({ where: { id: params.id, userId: session.userId }, select: { id: true } });
    if (!existing) return jsonError("Product not found", 404);
    const product = await db.product.update({ where: { id: existing.id }, data: result.data });
    return NextResponse.json({ product });
  } catch (error) {
    if (isUniqueConstraint(error)) return jsonError("That SKU already exists in your inventory", 409);
    return jsonError("We couldn't update the product. Please try again.", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  const result = await db.product.deleteMany({ where: { id: params.id, userId: session.userId } });
  if (result.count === 0) return jsonError("Product not found", 404);
  return NextResponse.json({ success: true });
}
