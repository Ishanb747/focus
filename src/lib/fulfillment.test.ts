import { describe, expect, it } from "vitest";
import { planFulfillment, UnknownSkuError, type StockLine } from "./fulfillment";

const stock: StockLine[] = [
  { id: "p1", sku: "BOX-1", name: "Storage box", quantity: 10 },
  { id: "p2", sku: "TAPE-1", name: "Packing tape", quantity: 2 },
  { id: "p3", sku: "LABEL-1", name: "Label roll", quantity: 0 },
];

describe("planFulfillment", () => {
  it("fully fulfills a multi-SKU order when stock is available", () => {
    const plan = planFulfillment(
      [
        { sku: "BOX-1", quantity: 4 },
        { sku: "TAPE-1", quantity: 2 },
      ],
      stock,
    );
    expect(plan).toMatchObject({ status: "FULFILLED", totalRequested: 6, totalFulfilled: 6, totalBackordered: 0 });
    expect(plan.lines.map((line) => line.stockAfter)).toEqual([6, 0]);
  });

  it("partially fulfills available stock and backorders the remainder", () => {
    const plan = planFulfillment(
      [
        { sku: "BOX-1", quantity: 12 },
        { sku: "TAPE-1", quantity: 1 },
      ],
      stock,
    );
    expect(plan).toMatchObject({ status: "PARTIALLY_FULFILLED", totalRequested: 13, totalFulfilled: 11, totalBackordered: 2 });
    expect(plan.lines[0]).toMatchObject({ fulfilledQuantity: 10, backorderedQuantity: 2, stockAfter: 0 });
  });

  it("backorders an order when every requested item is out of stock", () => {
    const plan = planFulfillment([{ sku: "LABEL-1", quantity: 5 }], stock);
    expect(plan).toMatchObject({ status: "BACKORDERED", totalFulfilled: 0, totalBackordered: 5 });
  });

  it("does not mutate stock while planning", () => {
    const before = structuredClone(stock);
    planFulfillment([{ sku: "BOX-1", quantity: 3 }], stock);
    expect(stock).toEqual(before);
  });

  it("rejects unknown SKUs before any deduction is planned", () => {
    expect(() => planFulfillment([{ sku: "MISSING", quantity: 1 }], stock)).toThrow(UnknownSkuError);
  });
});
