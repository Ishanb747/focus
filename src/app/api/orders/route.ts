import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { UnknownSkuError } from "@/lib/fulfillment";
import { fulfillOrder, orderInclude } from "@/lib/order-service";
import { firstValidationError, orderSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);

  const orders = await db.order.findMany({
    where: { userId: session.userId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);

  try {
    const body: unknown = await request.json();
    const result = orderSchema.safeParse(body);
    if (!result.success) return jsonError(firstValidationError(result.error), 400, result.error.flatten());

    const order = await fulfillOrder(session.userId, result.data.items);

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof UnknownSkuError) return jsonError(error.message, 400);
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON", 400);
    return jsonError("We couldn't fulfill the order. No stock was changed.", 500);
  }
}
