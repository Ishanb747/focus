import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { fulfillOrder } from "../src/lib/order-service";

async function main() {
  const suffix = Date.now().toString(36).toUpperCase();
  const sku = `RACE-${suffix}`;
  let userId: string | undefined;

  try {
    const user = await db.user.create({
      data: {
        name: "Concurrency Verification",
        email: `concurrency.${suffix.toLowerCase()}@stockroom.test`,
        passwordHash: "integration-test-only",
        products: { create: { sku, name: "Concurrency stock", category: "Verification", quantity: 10, lowStockThreshold: 2 } },
      },
    });
    userId = user.id;

    const orders = await Promise.all([
      fulfillOrder(user.id, [{ sku, quantity: 8 }]),
      fulfillOrder(user.id, [{ sku, quantity: 8 }]),
    ]);

    const product = await db.product.findFirstOrThrow({ where: { userId: user.id, sku } });
    const persistedOrders = await db.order.findMany({
      where: { userId: user.id },
      include: { items: true, auditEvents: true },
    });

    const totalFulfilled = orders.reduce((total, order) => total + order.totalFulfilled, 0);
    const totalBackordered = orders.reduce((total, order) => total + order.totalBackordered, 0);
    const statuses = orders.map((order) => order.status).sort();
    const auditActions = persistedOrders.flatMap((order) => order.auditEvents.map((event) => event.action));

    assert.equal(totalFulfilled, 10, "concurrent fulfillment must not exceed starting stock");
    assert.equal(totalBackordered, 6, "the unavailable remainder must be backordered");
    assert.equal(product.quantity, 0, "all available stock should be consumed exactly once");
    assert.deepEqual(statuses, ["FULFILLED", "PARTIALLY_FULFILLED"]);
    assert.equal(persistedOrders.length, 2, "both orders must be persisted");
    assert.equal(auditActions.filter((action) => action === "ORDER_CREATED").length, 2);
    assert.equal(auditActions.filter((action) => action === "STOCK_DEDUCTED").length, 2);
    assert.equal(auditActions.filter((action) => action === "ITEM_BACKORDERED").length, 1);

    console.log("Concurrency verification passed", {
      startingStock: 10,
      requested: 16,
      fulfilled: totalFulfilled,
      backordered: totalBackordered,
      endingStock: product.quantity,
      statuses,
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
