export const ZONES = ["NORTH", "WEST", "SOUTH", "EAST", "NORTHEAST", "REMOTE"] as const;
export type Zone = (typeof ZONES)[number];

export interface ShipmentInput {
  destinationPincode: string;
  actualWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface VehicleType {
  id: "MINI_VAN" | "BOX_TRUCK" | "HEAVY_TRUCK";
  name: string;
  capacityKg: number;
  dispatchFeePaise: number;
}

type Fleet = Record<VehicleType["id"], number>;

export interface Warehouse {
  id: string;
  name: string;
  pincode: string;
  zone: Zone;
  handlingFeePaise: number;
  fleet: Fleet;
}

export interface VehicleAllocation {
  vehicleId: VehicleType["id"];
  vehicleName: string;
  count: number;
  capacityKg: number;
  subtotalPaise: number;
}

export interface RouteOption {
  warehouseId: string;
  warehouseName: string;
  originZone: Zone;
  destinationZone: Zone;
  ratePaisePerKg: number;
  linehaulPaise: number;
  handlingPaise: number;
  vehiclePaise: number;
  totalCostPaise: number;
  totalCapacityKg: number;
  unusedCapacityKg: number;
  vehicleCount: number;
  vehicles: VehicleAllocation[];
}

export interface RoutingQuote {
  destinationPincode: string;
  destinationZone: Zone;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  volumetricDivisor: number;
  billingIncrementKg: number;
  selected: RouteOption;
  alternatives: RouteOption[];
  justification: string;
}

export class InvalidPincodeError extends Error {
  constructor(pincode: string) {
    super(`Pincode ${pincode} is outside the configured delivery zones`);
    this.name = "InvalidPincodeError";
  }
}

export class NoViableRouteError extends Error {
  constructor(weightKg: number) {
    super(`No warehouse fleet can carry ${weightKg.toFixed(2)} kg`);
    this.name = "NoViableRouteError";
  }
}

export const VEHICLES: readonly VehicleType[] = [
  { id: "MINI_VAN", name: "Mini van", capacityKg: 100, dispatchFeePaise: 35_000 },
  { id: "BOX_TRUCK", name: "Box truck", capacityKg: 500, dispatchFeePaise: 95_000 },
  { id: "HEAVY_TRUCK", name: "Heavy truck", capacityKg: 1_500, dispatchFeePaise: 220_000 },
] as const;

export const WAREHOUSES: readonly Warehouse[] = [
  { id: "DEL", name: "Delhi North Hub", pincode: "110001", zone: "NORTH", handlingFeePaise: 18_000, fleet: { MINI_VAN: 4, BOX_TRUCK: 3, HEAVY_TRUCK: 2 } },
  { id: "BOM", name: "Mumbai West Hub", pincode: "400001", zone: "WEST", handlingFeePaise: 20_000, fleet: { MINI_VAN: 3, BOX_TRUCK: 4, HEAVY_TRUCK: 3 } },
  { id: "MAA", name: "Chennai South Hub", pincode: "600001", zone: "SOUTH", handlingFeePaise: 17_000, fleet: { MINI_VAN: 2, BOX_TRUCK: 3, HEAVY_TRUCK: 2 } },
  { id: "CCU", name: "Kolkata East Hub", pincode: "700001", zone: "EAST", handlingFeePaise: 16_000, fleet: { MINI_VAN: 2, BOX_TRUCK: 2, HEAVY_TRUCK: 2 } },
  { id: "GAU", name: "Guwahati Northeast Hub", pincode: "781001", zone: "NORTHEAST", handlingFeePaise: 21_000, fleet: { MINI_VAN: 2, BOX_TRUCK: 1, HEAVY_TRUCK: 1 } },
] as const;

// Values are paise per chargeable kg. The matrix is symmetric and intentionally
// explicit so every lane can be audited and changed without touching the engine.
export const ZONE_RATE_MATRIX: Readonly<Record<Zone, Readonly<Record<Zone, number>>>> = {
  NORTH: { NORTH: 900, WEST: 1_250, SOUTH: 1_650, EAST: 1_400, NORTHEAST: 1_850, REMOTE: 2_100 },
  WEST: { NORTH: 1_250, WEST: 850, SOUTH: 1_300, EAST: 1_550, NORTHEAST: 2_000, REMOTE: 2_050 },
  SOUTH: { NORTH: 1_650, WEST: 1_300, SOUTH: 800, EAST: 1_250, NORTHEAST: 1_950, REMOTE: 2_150 },
  EAST: { NORTH: 1_400, WEST: 1_550, SOUTH: 1_250, EAST: 800, NORTHEAST: 1_150, REMOTE: 1_900 },
  NORTHEAST: { NORTH: 1_850, WEST: 2_000, SOUTH: 1_950, EAST: 1_150, NORTHEAST: 950, REMOTE: 1_700 },
  REMOTE: { NORTH: 2_100, WEST: 2_050, SOUTH: 2_150, EAST: 1_900, NORTHEAST: 1_700, REMOTE: 1_300 },
};

const VOLUMETRIC_DIVISOR = 5_000;
const BILLING_INCREMENT_KG = 0.5;

export function zoneForPincode(pincode: string): Zone {
  if (!/^\d{6}$/.test(pincode)) throw new InvalidPincodeError(pincode);
  const prefix = Number(pincode.slice(0, 2));
  if (prefix >= 11 && prefix <= 29) return "NORTH";
  if (prefix >= 30 && prefix <= 49) return "WEST";
  if (prefix >= 50 && prefix <= 69) return "SOUTH";
  if ((prefix >= 70 && prefix <= 77) || (prefix >= 80 && prefix <= 85)) return "EAST";
  if (prefix === 78 || prefix === 79) return "NORTHEAST";
  if (prefix >= 86 && prefix <= 99) return "REMOTE";
  throw new InvalidPincodeError(pincode);
}

function round(value: number, places = 2) {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function optimizeFleet(weightKg: number, fleet: Fleet) {
  let best: { allocations: VehicleAllocation[]; capacityKg: number; costPaise: number; vehicleCount: number } | undefined;
  for (let mini = 0; mini <= fleet.MINI_VAN; mini += 1) {
    for (let box = 0; box <= fleet.BOX_TRUCK; box += 1) {
      for (let heavy = 0; heavy <= fleet.HEAVY_TRUCK; heavy += 1) {
        const counts: Fleet = { MINI_VAN: mini, BOX_TRUCK: box, HEAVY_TRUCK: heavy };
        const vehicleCount = mini + box + heavy;
        if (!vehicleCount) continue;
        const capacityKg = VEHICLES.reduce((total, vehicle) => total + counts[vehicle.id] * vehicle.capacityKg, 0);
        if (capacityKg < weightKg) continue;
        const costPaise = VEHICLES.reduce((total, vehicle) => total + counts[vehicle.id] * vehicle.dispatchFeePaise, 0);
        const candidate = {
          allocations: VEHICLES.filter((vehicle) => counts[vehicle.id] > 0).map((vehicle) => ({
            vehicleId: vehicle.id,
            vehicleName: vehicle.name,
            count: counts[vehicle.id],
            capacityKg: counts[vehicle.id] * vehicle.capacityKg,
            subtotalPaise: counts[vehicle.id] * vehicle.dispatchFeePaise,
          })),
          capacityKg,
          costPaise,
          vehicleCount,
        };
        if (!best || candidate.costPaise < best.costPaise ||
          (candidate.costPaise === best.costPaise && candidate.vehicleCount < best.vehicleCount) ||
          (candidate.costPaise === best.costPaise && candidate.vehicleCount === best.vehicleCount && candidate.capacityKg < best.capacityKg)) {
          best = candidate;
        }
      }
    }
  }
  return best;
}

export function calculateRoutingQuote(input: ShipmentInput): RoutingQuote {
  const destinationZone = zoneForPincode(input.destinationPincode);
  const volumetricWeightKg = round((input.lengthCm * input.widthCm * input.heightCm) / VOLUMETRIC_DIVISOR, 3);
  const rawChargeableWeight = Math.max(input.actualWeightKg, volumetricWeightKg);
  const chargeableWeightKg = round(Math.ceil(rawChargeableWeight / BILLING_INCREMENT_KG) * BILLING_INCREMENT_KG);

  const options = WAREHOUSES.flatMap((warehouse): RouteOption[] => {
    const fleet = optimizeFleet(chargeableWeightKg, warehouse.fleet);
    if (!fleet) return [];
    const ratePaisePerKg = ZONE_RATE_MATRIX[warehouse.zone][destinationZone];
    const linehaulPaise = Math.round(ratePaisePerKg * chargeableWeightKg);
    const totalCostPaise = linehaulPaise + warehouse.handlingFeePaise + fleet.costPaise;
    return [{
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      originZone: warehouse.zone,
      destinationZone,
      ratePaisePerKg,
      linehaulPaise,
      handlingPaise: warehouse.handlingFeePaise,
      vehiclePaise: fleet.costPaise,
      totalCostPaise,
      totalCapacityKg: fleet.capacityKg,
      unusedCapacityKg: round(fleet.capacityKg - chargeableWeightKg),
      vehicleCount: fleet.vehicleCount,
      vehicles: fleet.allocations,
    }];
  }).sort((a, b) => a.totalCostPaise - b.totalCostPaise || a.vehicleCount - b.vehicleCount || a.unusedCapacityKg - b.unusedCapacityKg || a.warehouseId.localeCompare(b.warehouseId));

  const selected = options[0];
  if (!selected) throw new NoViableRouteError(chargeableWeightKg);
  const weightReason = volumetricWeightKg > input.actualWeightKg
    ? `volumetric weight ${volumetricWeightKg.toFixed(2)} kg exceeded actual weight ${input.actualWeightKg.toFixed(2)} kg`
    : `actual weight ${input.actualWeightKg.toFixed(2)} kg was at least the volumetric weight ${volumetricWeightKg.toFixed(2)} kg`;
  const vehicleReason = selected.vehicles.map((vehicle) => `${vehicle.count} x ${vehicle.vehicleName}`).join(" + ");
  const justification = `${selected.warehouseName} was cheapest across ${options.length} viable warehouse routes. ${weightReason}; billed at ${chargeableWeightKg.toFixed(2)} kg. ${vehicleReason} provides ${selected.totalCapacityKg.toFixed(0)} kg capacity for ${selected.vehicleCount} vehicle${selected.vehicleCount === 1 ? "" : "s"}.`;

  return {
    destinationPincode: input.destinationPincode,
    destinationZone,
    actualWeightKg: input.actualWeightKg,
    volumetricWeightKg,
    chargeableWeightKg,
    volumetricDivisor: VOLUMETRIC_DIVISOR,
    billingIncrementKg: BILLING_INCREMENT_KG,
    selected,
    alternatives: options.slice(1, 4),
    justification,
  };
}
