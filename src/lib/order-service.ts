import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { planFulfillment, type RequestedLine, type StockLine } from "@/lib/fulfillment";

interface LockedProduct {
  id: string;
  sku: string;
  name: string;
  quantity: number;
}

export const orderInclude = {
  items: { orderBy: { sku: "asc" as const } },
  auditEvents: { orderBy: { createdAt: "asc" as const } },
};

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function fulfillOrder(userId: string, items: RequestedLine[]) {
  return db.$transaction(
    async (transaction: TransactionClient) => {
      const skus = items.map((item) => item.sku);

      // Row locks are acquired in a stable order. Concurrent orders requesting the
      // same SKU wait here, then calculate from the committed post-order stock.
      const lockedProducts = await transaction.$queryRaw<LockedProduct[]>(
        Prisma.sql`
          SELECT "id", "sku", "name", "quantity"
          FROM "Product"
          WHERE "userId" = ${userId}
            AND "sku" IN (${Prisma.join(skus)})
          ORDER BY "id"
          FOR UPDATE
        `,
      );

      const plan = planFulfillment(items, lockedProducts satisfies StockLine[]);

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
          userId,
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
}
