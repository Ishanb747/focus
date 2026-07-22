import { describe, expect, it } from "vitest";
import { loginSchema, orderSchema, productSchema, rateQuoteSchema, registerSchema } from "./validation";

describe("registration validation", () => {
  it("normalizes email and accepts a strong password", () => {
    const result = registerSchema.parse({ name: "Alex Morgan", email: " ALEX@EXAMPLE.COM ", password: "secure123" });
    expect(result.email).toBe("alex@example.com");
  });

  it("rejects short passwords without a number", () => {
    expect(registerSchema.safeParse({ name: "Alex", email: "alex@example.com", password: "short" }).success).toBe(false);
  });

  it("requires a login password", () => {
    expect(loginSchema.safeParse({ email: "alex@example.com", password: "" }).success).toBe(false);
  });
});

describe("product validation", () => {
  it("normalizes SKUs and numeric form values", () => {
    const product = productSchema.parse({ sku: " box-001 ", name: "Storage box", category: "Storage", quantity: "12", lowStockThreshold: "4" });
    expect(product).toMatchObject({ sku: "BOX-001", quantity: 12, lowStockThreshold: 4 });
  });

  it("allows zero stock", () => {
    expect(productSchema.safeParse({ sku: "BOX-1", name: "Box", category: "Storage", quantity: 0, lowStockThreshold: 5 }).success).toBe(true);
  });

  it("rejects negative and fractional quantities", () => {
    const base = { sku: "BOX-1", name: "Box", category: "Storage", lowStockThreshold: 5 };
    expect(productSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, quantity: 1.5 }).success).toBe(false);
  });
});

describe("order validation", () => {
  it("accepts multiple normalized SKUs with positive quantities", () => {
    const order = orderSchema.parse({ items: [{ sku: " box-1 ", quantity: "2" }, { sku: "tape-1", quantity: 4 }] });
    expect(order.items).toEqual([{ sku: "BOX-1", quantity: 2 }, { sku: "TAPE-1", quantity: 4 }]);
  });

  it("rejects zero quantities and duplicate SKUs", () => {
    expect(orderSchema.safeParse({ items: [{ sku: "BOX-1", quantity: 0 }] }).success).toBe(false);
    expect(orderSchema.safeParse({ items: [{ sku: "BOX-1", quantity: 1 }, { sku: "box-1", quantity: 2 }] }).success).toBe(false);
  });
});

describe("rate quote validation", () => {
  it("coerces positive shipment measurements", () => {
    expect(rateQuoteSchema.parse({ destinationPincode: " 400001 ", actualWeightKg: "12.5", lengthCm: "40", widthCm: 30, heightCm: 20 })).toEqual({
      destinationPincode: "400001", actualWeightKg: 12.5, lengthCm: 40, widthCm: 30, heightCm: 20,
    });
  });

  it("rejects malformed pincodes and non-positive dimensions", () => {
    expect(rateQuoteSchema.safeParse({ destinationPincode: "40001", actualWeightKg: 2, lengthCm: 40, widthCm: 30, heightCm: 20 }).success).toBe(false);
    expect(rateQuoteSchema.safeParse({ destinationPincode: "400001", actualWeightKg: 2, lengthCm: 0, widthCm: 30, heightCm: 20 }).success).toBe(false);
  });
});
