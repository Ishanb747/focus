import { describe, expect, it } from "vitest";
import { calculateRoutingQuote, InvalidPincodeError, NoViableRouteError, zoneForPincode, ZONE_RATE_MATRIX } from "./routing";

describe("pincode zones", () => {
  it("maps representative Indian pincodes to configured zones", () => {
    expect(zoneForPincode("110001")).toBe("NORTH");
    expect(zoneForPincode("400001")).toBe("WEST");
    expect(zoneForPincode("600001")).toBe("SOUTH");
    expect(zoneForPincode("700001")).toBe("EAST");
    expect(zoneForPincode("781001")).toBe("NORTHEAST");
    expect(zoneForPincode("900001")).toBe("REMOTE");
  });

  it("rejects malformed and unconfigured pincodes", () => {
    expect(() => zoneForPincode("12345")).toThrow(InvalidPincodeError);
    expect(() => zoneForPincode("010001")).toThrow(InvalidPincodeError);
  });

  it("keeps the zone rate matrix symmetric", () => {
    for (const [origin, lanes] of Object.entries(ZONE_RATE_MATRIX)) {
      for (const [destination, rate] of Object.entries(lanes)) {
        expect(ZONE_RATE_MATRIX[destination as keyof typeof ZONE_RATE_MATRIX][origin as keyof typeof ZONE_RATE_MATRIX]).toBe(rate);
      }
    }
  });
});

describe("routing optimizer", () => {
  it("uses actual weight when it is higher and chooses the local-zone warehouse", () => {
    const quote = calculateRoutingQuote({ destinationPincode: "110045", actualWeightKg: 10, lengthCm: 20, widthCm: 20, heightCm: 20 });
    expect(quote.volumetricWeightKg).toBe(1.6);
    expect(quote.chargeableWeightKg).toBe(10);
    expect(quote.selected.warehouseId).toBe("DEL");
    expect(quote.selected.vehicleCount).toBe(1);
  });

  it("uses volumetric weight and rounds up to a half-kilogram billing increment", () => {
    const quote = calculateRoutingQuote({ destinationPincode: "400050", actualWeightKg: 2, lengthCm: 61, widthCm: 41, heightCm: 31 });
    expect(quote.volumetricWeightKg).toBe(15.506);
    expect(quote.chargeableWeightKg).toBe(16);
    expect(quote.justification).toContain("volumetric weight");
  });

  it("splits overweight shipments across the cheapest vehicle combination", () => {
    const quote = calculateRoutingQuote({ destinationPincode: "400050", actualWeightKg: 1_800, lengthCm: 10, widthCm: 10, heightCm: 10 });
    expect(quote.selected.totalCapacityKg).toBeGreaterThanOrEqual(1_800);
    expect(quote.selected.vehicleCount).toBeGreaterThan(1);
    expect(quote.selected.vehicles.reduce((total, vehicle) => total + vehicle.capacityKg, 0)).toBe(quote.selected.totalCapacityKg);
  });

  it("returns sorted alternatives and an auditable cost breakdown", () => {
    const quote = calculateRoutingQuote({ destinationPincode: "781010", actualWeightKg: 420, lengthCm: 40, widthCm: 30, heightCm: 20 });
    expect(quote.alternatives.length).toBe(3);
    expect(quote.alternatives.every((option) => option.totalCostPaise >= quote.selected.totalCostPaise)).toBe(true);
    expect(quote.selected.totalCostPaise).toBe(quote.selected.linehaulPaise + quote.selected.handlingPaise + quote.selected.vehiclePaise);
    expect(quote.justification).toContain("was cheapest");
  });

  it("fails clearly when no configured fleet can carry the shipment", () => {
    expect(() => calculateRoutingQuote({ destinationPincode: "110001", actualWeightKg: 10_000, lengthCm: 10, widthCm: 10, heightCm: 10 })).toThrow(NoViableRouteError);
  });
});
