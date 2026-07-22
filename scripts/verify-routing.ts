import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { calculateAndSaveQuote } from "../src/lib/rate-service";
import { NoViableRouteError } from "../src/lib/routing";

async function main() {
  const suffix = Date.now().toString(36).toLowerCase();
  let userId: string | undefined;

  try {
    const user = await db.user.create({
      data: {
        name: "Routing Verification",
        email: `routing.${suffix}@stockroom.test`,
        passwordHash: "integration-test-only",
      },
    });
    userId = user.id;

    const actualWeightQuote = await calculateAndSaveQuote(user.id, {
      destinationPincode: "110045",
      actualWeightKg: 10,
      lengthCm: 20,
      widthCm: 20,
      heightCm: 20,
    });
    assert.equal(actualWeightQuote.warehouseId, "DEL");
    assert.equal(actualWeightQuote.destinationZone, "NORTH");
    assert.equal(actualWeightQuote.chargeableWeightKg, 10);
    assert.equal(actualWeightQuote.vehicleCount, 1);

    const volumetricQuote = await calculateAndSaveQuote(user.id, {
      destinationPincode: "400050",
      actualWeightKg: 2,
      lengthCm: 61,
      widthCm: 41,
      heightCm: 31,
    });
    assert.equal(volumetricQuote.warehouseId, "BOM");
    assert.equal(volumetricQuote.volumetricWeightKg, 15.506);
    assert.equal(volumetricQuote.chargeableWeightKg, 16);
    assert.match(volumetricQuote.justification, /volumetric weight/);

    const splitQuote = await calculateAndSaveQuote(user.id, {
      destinationPincode: "400050",
      actualWeightKg: 1_800,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
    });
    assert.ok(splitQuote.vehicleCount > 1, "over-capacity shipment must use multiple vehicles");
    assert.ok(splitQuote.totalCapacityKg >= splitQuote.chargeableWeightKg);
    assert.equal(splitQuote.totalCostPaise, splitQuote.linehaulPaise + splitQuote.handlingPaise + splitQuote.vehiclePaise);
    assert.ok(Array.isArray(splitQuote.vehicles));
    assert.ok(Array.isArray(splitQuote.alternatives));

    const beforeFailure = await db.deliveryQuote.count({ where: { userId: user.id } });
    await assert.rejects(
      calculateAndSaveQuote(user.id, { destinationPincode: "110001", actualWeightKg: 10_000, lengthCm: 10, widthCm: 10, heightCm: 10 }),
      (error: unknown) => error instanceof NoViableRouteError,
    );
    assert.equal(await db.deliveryQuote.count({ where: { userId: user.id } }), beforeFailure, "unroutable shipment must not persist a quote");

    const history = await db.deliveryQuote.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    assert.equal(history.length, 3);
    assert.deepEqual(history.map((quote) => quote.destinationZone), ["NORTH", "WEST", "WEST"]);

    console.log("Routing verification passed", {
      actualWeight: { warehouse: actualWeightQuote.warehouseName, chargeableKg: actualWeightQuote.chargeableWeightKg },
      volumetricWeight: { warehouse: volumetricQuote.warehouseName, volumetricKg: volumetricQuote.volumetricWeightKg, chargeableKg: volumetricQuote.chargeableWeightKg },
      capacitySplit: { vehicles: splitQuote.vehicleCount, plannedKg: splitQuote.totalCapacityKg, shipmentKg: splitQuote.chargeableWeightKg },
      persistedQuotes: history.length,
      unroutableQuoteRejected: true,
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
