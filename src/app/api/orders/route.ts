import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { planFulfillment, UnknownSkuError, type StockLine } from "@/lib/fulfillment";
import { firstValidationError, orderSchema } from "@/lib/validation";

interface LockedProduct {
  id: string;
  sku: string;
  name: string;
  quantity: number;
}

const orderInclude = {
  items: { orderBy: { sku: "asc" as const } },
  auditEvents: { orderBy: { createdAt: "asc" as const } },
};

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

    const order = await db.$transaction(
      async (transaction) => {
        const skus = result.data.items.map((item) => item.sku);

        // Row locks are acquired in a stable order. Concurrent orders requesting the
        // same SKU wait here, then calculate from the committed post-order stock.
        const lockedProducts = await transaction.$queryRaw<LockedProduct[]>(
          Prisma.sql`
            SELECT "id", "sku", "name", "quantity"
            FROM "Product"
            WHERE "userId" = ${session.userId}
              AND "sku" IN (${Prisma.join(skus)})
            ORDER BY "id"
            FOR UPDATE
          `,
        );

        const plan = planFulfillment(result.data.items, lockedProducts satisfies StockLine[]);

        for (const line of plan.lines) {
          if (line.fulfilledQuantity > 0) {
            await transaction.product.update({
              where: { id: line.productId },
              data: { quantity: line.stockAfter },
            });
          }
        }

        const auditEvents: Prisma.OrderAuditCreateWithoutOrderInput[] = [
          {
            action: "ORDER_CREATED",
            message: `Order created with ${plan.lines.length} line item${plan.lines.length === 1 ? "" : "s"}`,
            details: {
              status: plan.status,
              totalRequested: plan.totalRequested,
              totalFulfilled: plan.totalFulfilled,
              totalBackordered: plan.totalBackordered,
            },
          },
          ...plan.lines.flatMap((line): Prisma.OrderAuditCreateWithoutOrderInput[] => {
            const events: Prisma.OrderAuditCreateWithoutOrderInput[] = [];
            if (line.fulfilledQuantity > 0) {
              events.push({
                action: "STOCK_DEDUCTED",
                message: `Deducted ${line.fulfilledQuantity} unit${line.fulfilledQuantity === 1 ? "" : "s"} of ${line.sku}`,
                details: {
                  sku: line.sku,
                  stockBefore: line.stockBefore,
                  stockAfter: line.stockAfter,
                  fulfilledQuantity: line.fulfilledQuantity,
                },
              });
            }
            if (line.backorderedQuantity > 0) {
              events.push({
                action: "ITEM_BACKORDERED",
                message: `Backordered ${line.backorderedQuantity} unit${line.backorderedQuantity === 1 ? "" : "s"} of ${line.sku}`,
                details: { sku: line.sku, backorderedQuantity: line.backorderedQuantity },
              });
            }
            return events;
          }),
        ];

        return transaction.order.create({
          data: {
            userId: session.userId,
            status: plan.status,
            totalRequested: plan.totalRequested,
            totalFulfilled: plan.totalFulfilled,
            totalBackordered: plan.totalBackordered,
            items: {
              create: plan.lines.map((line) => ({
                sku: line.sku,
                productName: line.productName,
                requestedQuantity: line.requestedQuantity,
                fulfilledQuantity: line.fulfilledQuantity,
                backorderedQuantity: line.backorderedQuantity,
              })),
            },
            auditEvents: { create: auditEvents },
          },
          include: orderInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 20_000,
      },
    );

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof UnknownSkuError) return jsonError(error.message, 400);
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON", 400);
    return jsonError("We couldn't fulfill the order. No stock was changed.", 500);
  }
}
