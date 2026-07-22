"use client";

import { FormEvent, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { firstValidationError, rateQuoteSchema, type RateQuoteInput } from "@/lib/validation";

interface User { userId: string; name: string; email: string }

interface DeliveryQuote {
  id: string;
  userId: string;
  destinationPincode: string;
  destinationZone: string;
  actualWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  warehouseId: string;
  warehouseName: string;
  originZone: string;
  ratePaisePerKg: number;
  linehaulPaise: number;
  handlingPaise: number;
  vehiclePaise: number;
  totalCostPaise: number;
  totalCapacityKg: number;
  unusedCapacityKg: number;
  vehicleCount: number;
  vehicles: unknown;
  alternatives: unknown;
  justification: string;
  createdAt: string;
}

interface VehicleAllocation { vehicleId: string; vehicleName: string; count: number; capacityKg: number; subtotalPaise: number }
interface RouteAlternative { warehouseId: string; warehouseName: string; originZone: string; totalCostPaise: number; vehicleCount: number }

const initialForm: RateQuoteInput = { destinationPincode: "400001", actualWeightKg: 12, lengthCm: 40, widthCm: 30, heightCm: 20 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function vehiclesFrom(value: unknown): VehicleAllocation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): VehicleAllocation[] => isRecord(item) &&
    typeof item.vehicleId === "string" && typeof item.vehicleName === "string" &&
    typeof item.count === "number" && typeof item.capacityKg === "number" && typeof item.subtotalPaise === "number"
    ? [{ vehicleId: item.vehicleId, vehicleName: item.vehicleName, count: item.count, capacityKg: item.capacityKg, subtotalPaise: item.subtotalPaise }]
    : []);
}

function alternativesFrom(value: unknown): RouteAlternative[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): RouteAlternative[] => isRecord(item) &&
    typeof item.warehouseId === "string" && typeof item.warehouseName === "string" && typeof item.originZone === "string" &&
    typeof item.totalCostPaise === "number" && typeof item.vehicleCount === "number"
    ? [{ warehouseId: item.warehouseId, warehouseName: item.warehouseName, originZone: item.originZone, totalCostPaise: item.totalCostPaise, vehicleCount: item.vehicleCount }]
    : []);
}

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function RoutingIcon({ name }: { name: "route" | "scale" | "truck" | "calculator" | "arrow" }) {
  const paths = {
    route: <><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h3a4 4 0 0 0 4-4v-6a4 4 0 0 1 4-4"/></>,
    scale: <><path d="M12 3v18M5 7h14M6 7l-3 6h6L6 7ZM18 7l-3 6h6l-3-6ZM8 21h8"/></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function RoutingDashboard({ initialQuotes, lowStockCount, orderCount, productCount, user }: { initialQuotes: DeliveryQuote[]; lowStockCount: number; orderCount: number; productCount: number; user: User }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [current, setCurrent] = useState<DeliveryQuote | null>(null);
  const [form, setForm] = useState<RateQuoteInput>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof RateQuoteInput>(key: K, value: RateQuoteInput[K]) {
    setForm((existing) => ({ ...existing, [key]: value }));
  }

  async function calculate(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = rateQuoteSchema.safeParse(form);
    if (!parsed.success) { setError(firstValidationError(parsed.error)); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = (await response.json()) as { quote?: DeliveryQuote; error?: string };
      if (!response.ok || !data.quote) throw new Error(data.error ?? "Unable to calculate route");
      setCurrent(data.quote);
      setQuotes((existing) => [data.quote!, ...existing]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to calculate route");
    } finally {
      setSubmitting(false);
    }
  }

  const currentVehicles = current ? vehiclesFrom(current.vehicles) : [];
  const currentAlternatives = current ? alternativesFrom(current.alternatives) : [];

  return (
    <main className="app-shell">
      <AppSidebar user={user} active="routing" productCount={productCount} lowStockCount={lowStockCount} orderCount={orderCount} quoteCount={quotes.length}/>
      <section className="dashboard-main routing-main">
        <header className="dashboard-header">
          <div><p className="eyebrow"><span/>DELIVERY OPTIMIZATION</p><h1>Rate &amp; routing</h1><p>Compare warehouse lanes, dimensional weight, and fleet capacity in one auditable quote.</p></div>
        </header>

        <section className="routing-grid">
          <article className="rate-calculator">
            <header><span><RoutingIcon name="calculator"/></span><div><h2>Shipment details</h2><p>Measurements use kilograms and centimetres.</p></div></header>
            <form onSubmit={calculate} noValidate>
              <label className="wide"><span>Destination pincode</span><input aria-label="Destination pincode" inputMode="numeric" maxLength={6} value={form.destinationPincode} onChange={(event) => update("destinationPincode", event.target.value)} disabled={submitting}/><small>Six-digit Indian delivery pincode</small></label>
              <label className="wide"><span>Actual weight</span><div className="unit-input"><input aria-label="Actual weight" type="number" min="0.01" step="0.01" value={form.actualWeightKg} onChange={(event) => update("actualWeightKg", Number(event.target.value))} disabled={submitting}/><b>kg</b></div></label>
              <div className="dimension-label"><span>Package dimensions</span><small>Length × width × height</small></div>
              <div className="dimension-grid">
                {(["lengthCm", "widthCm", "heightCm"] as const).map((key) => <label key={key}><span>{key === "lengthCm" ? "Length" : key === "widthCm" ? "Width" : "Height"}</span><div className="unit-input"><input aria-label={key === "lengthCm" ? "Length" : key === "widthCm" ? "Width" : "Height"} type="number" min="0.01" step="0.01" value={form[key]} onChange={(event) => update(key, Number(event.target.value))} disabled={submitting}/><b>cm</b></div></label>)}
              </div>
              {error && <div className="form-error" role="alert"><span>!</span>{error}</div>}
              <button className="button button-primary calculate-rate" disabled={submitting}>{submitting ? <><span className="spinner"/>Optimizing routes…</> : <><RoutingIcon name="route"/>Find cheapest route</>}</button>
            </form>
            <footer><span>DIM divisor 5,000</span><span>0.5 kg billing increment</span><span>5 warehouse hubs</span></footer>
          </article>

          <article className={`route-result ${current ? "has-result" : ""}`}>
            {current ? <>
              <header><div><p>CHEAPEST VIABLE OPTION</p><h2>{current.warehouseName}</h2></div><strong>{money(current.totalCostPaise)}</strong></header>
              <div className="route-lane"><span>{current.originZone}<small>{current.warehouseId}</small></span><i><RoutingIcon name="arrow"/></i><span>{current.destinationZone}<small>{current.destinationPincode}</small></span></div>
              <div className="weight-comparison">
                <div><span><RoutingIcon name="scale"/></span><small>ACTUAL</small><b>{current.actualWeightKg.toFixed(2)} kg</b></div>
                <div><span><RoutingIcon name="calculator"/></span><small>VOLUMETRIC</small><b>{current.volumetricWeightKg.toFixed(2)} kg</b></div>
                <div className="chargeable"><span><RoutingIcon name="truck"/></span><small>CHARGEABLE</small><b>{current.chargeableWeightKg.toFixed(2)} kg</b></div>
              </div>
              <section className="vehicle-plan"><h3>Capacity plan</h3>{currentVehicles.map((vehicle) => <div key={vehicle.vehicleId}><span><b>{vehicle.count} × {vehicle.vehicleName}</b><small>{vehicle.capacityKg.toLocaleString()} kg capacity</small></span><strong>{money(vehicle.subtotalPaise)}</strong></div>)}<p>{current.totalCapacityKg.toLocaleString()} kg planned · {current.unusedCapacityKg.toLocaleString()} kg spare</p></section>
              <section className="cost-breakdown"><div><span>Linehaul ({money(current.ratePaisePerKg)}/kg)</span><b>{money(current.linehaulPaise)}</b></div><div><span>Warehouse handling</span><b>{money(current.handlingPaise)}</b></div><div><span>Vehicle dispatch</span><b>{money(current.vehiclePaise)}</b></div><div className="cost-total"><span>Total</span><b>{money(current.totalCostPaise)}</b></div></section>
              <p className="route-justification">{current.justification}</p>
              {currentAlternatives.length > 0 && <details className="route-alternatives"><summary>Compare {currentAlternatives.length} alternatives</summary>{currentAlternatives.map((alternative) => <div key={alternative.warehouseId}><span>{alternative.warehouseName}<small>{alternative.originZone} · {alternative.vehicleCount} vehicle{alternative.vehicleCount === 1 ? "" : "s"}</small></span><b>{money(alternative.totalCostPaise)}</b></div>)}</details>}
            </> : <div className="route-placeholder"><span><RoutingIcon name="route"/></span><h2>Your optimized route will appear here</h2><p>We evaluate every warehouse lane and all viable fleet combinations, then explain the cheapest result.</p><div><i/>Zone-rate matrix<i/>Volumetric billing<i/>Fleet constraints</div></div>}
          </article>
        </section>

        <section className="quote-history">
          <header><div><h2>Quote history</h2><p>Latest 50 persisted calculations</p></div><span>{quotes.length} quote{quotes.length === 1 ? "" : "s"}</span></header>
          {quotes.length ? <div className="quote-list">{quotes.map((quote) => <article key={quote.id}><div className="quote-route"><span>{quote.originZone}</span><RoutingIcon name="arrow"/><span>{quote.destinationZone}</span></div><div><b>{quote.warehouseName}</b><small>To {quote.destinationPincode} · {quote.chargeableWeightKg.toFixed(2)} kg · {quote.vehicleCount} vehicle{quote.vehicleCount === 1 ? "" : "s"}</small></div><time dateTime={quote.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(quote.createdAt))}</time><strong>{money(quote.totalCostPaise)}</strong></article>)}</div> : <div className="quote-empty"><RoutingIcon name="route"/><p>No saved quotes yet. Calculate a shipment to start the audit trail.</p></div>}
        </section>
      </section>
    </main>
  );
}
