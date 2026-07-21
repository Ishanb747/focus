import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { UnknownSkuError } from "../src/lib/fulfillment";
import { fulfillOrder } from "../src/lib/order-service";

async function main() {
  const suffix = Date.now().toString(36).toUpperCase();
  const skus = {
    stocked: `ORDER-A-${suffix}`,
    limited: `ORDER-B-${suffix}`,
    empty: `ORDER-C-${suffix}`,
  };
  let userId: string | undefined;

  try {
    const user = await db.user.create({
      data: {
        name: "Order Verification",
        email: `orders.${suffix.toLowerCase()}@stockroom.test`,
        passwordHash: "integration-test-only",
        products: {
          create: [
            { sku: skus.stocked, name: "Stocked product", category: "Verification", quantity: 10, lowStockThreshold: 2 },
            { sku: skus.limited, name: "Limited product", category: "Verification", quantity: 2, lowStockThreshold: 2 },
            { sku: skus.empty, name: "Empty product", category: "Verification", quantity: 0, lowStockThreshold: 2 },
          ],
        },
      },
    });
    userId = user.id;

    const partial = await fulfillOrder(user.id, [
      { sku: skus.stocked, quantity: 4 },
      { sku: skus.limited, quantity: 5 },
    ]);
    assert.equal(partial.status, "PARTIALLY_FULFILLED");
    assert.deepEqual(
      [partial.totalRequested, partial.totalFulfilled, partial.totalBackordered],
      [9, 6, 3],
    );
    assert.deepEqual(
      partial.items.map((item) => [item.sku, item.requestedQuantity, item.fulfilledQuantity, item.backorderedQuantity]),
      [
        [skus.stocked, 4, 4, 0],
        [skus.limited, 5, 2, 3],
      ],
    );

    const backordered = await fulfillOrder(user.id, [{ sku: skus.empty, quantity: 3 }]);
    assert.equal(backordered.status, "BACKORDERED");
    assert.deepEqual(
      [backordered.totalRequested, backordered.totalFulfilled, backordered.totalBackordered],
      [3, 0, 3],
    );

    const orderCountBeforeFailure = await db.order.count({ where: { userId: user.id } });
    await assert.rejects(
      fulfillOrder(user.id, [{ sku: `UNKNOWN-${suffix}`, quantity: 1 }]),
      (error: unknown) => error instanceof UnknownSkuError,
    );
    assert.equal(
      await db.order.count({ where: { userId: user.id } }),
      orderCountBeforeFailure,
      "an invalid order must roll back without persisting history",
    );

    const products = await db.product.findMany({ where: { userId: user.id }, orderBy: { sku: "asc" } });
    assert.deepEqual(products.map((product) => product.quantity), [6, 0, 0]);

    const history = await db.order.findMany({
      where: { userId: user.id },
      include: { items: true, auditEvents: true },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(history.length, 2);
    assert.deepEqual(history.map((order) => order.status), ["PARTIALLY_FULFILLED", "BACKORDERED"]);
    assert.deepEqual(history.map((order) => order.auditEvents.length), [4, 2]);

    console.log("Order verification passed", {
      partial: { requested: 9, fulfilled: 6, backordered: 3 },
      zeroStock: { requested: 3, fulfilled: 0, backordered: 3 },
      endingStock: products.map((product) => ({ sku: product.sku, quantity: product.quantity })),
      invalidSkuRolledBack: true,
      persistedAuditEvents: history.reduce((total, order) => total + order.auditEvents.length, 0),
    });
  } finally {
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
