import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calculateRoutingQuote, type ShipmentInput } from "@/lib/routing";

export async function calculateAndSaveQuote(userId: string, input: ShipmentInput) {
  const quote = calculateRoutingQuote(input);
  return db.deliveryQuote.create({
    data: {
      userId,
      destinationPincode: quote.destinationPincode,
      destinationZone: quote.destinationZone,
      actualWeightKg: quote.actualWeightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      volumetricWeightKg: quote.volumetricWeightKg,
      chargeableWeightKg: quote.chargeableWeightKg,
      warehouseId: quote.selected.warehouseId,
      warehouseName: quote.selected.warehouseName,
      originZone: quote.selected.originZone,
      ratePaisePerKg: quote.selected.ratePaisePerKg,
      linehaulPaise: quote.selected.linehaulPaise,
      handlingPaise: quote.selected.handlingPaise,
      vehiclePaise: quote.selected.vehiclePaise,
      totalCostPaise: quote.selected.totalCostPaise,
      totalCapacityKg: quote.selected.totalCapacityKg,
      unusedCapacityKg: quote.selected.unusedCapacityKg,
      vehicleCount: quote.selected.vehicleCount,
      vehicles: quote.selected.vehicles as unknown as Prisma.InputJsonValue,
      alternatives: quote.alternatives as unknown as Prisma.InputJsonValue,
      justification: quote.justification,
    },
  });
}
