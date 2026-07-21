export type FulfillmentStatus = "FULFILLED" | "PARTIALLY_FULFILLED" | "BACKORDERED";

export interface RequestedLine {
  sku: string;
  quantity: number;
}

export interface StockLine {
  id: string;
  sku: string;
  name: string;
  quantity: number;
}

export interface FulfillmentLine {
  productId: string;
  sku: string;
  productName: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  backorderedQuantity: number;
  stockBefore: number;
  stockAfter: number;
}

export interface FulfillmentPlan {
  status: FulfillmentStatus;
  totalRequested: number;
  totalFulfilled: number;
  totalBackordered: number;
  lines: FulfillmentLine[];
}

export class UnknownSkuError extends Error {
  constructor(public readonly skus: string[]) {
    super(`Unknown SKU${skus.length === 1 ? "" : "s"}: ${skus.join(", ")}`);
    this.name = "UnknownSkuError";
  }
}

export function planFulfillment(requested: RequestedLine[], stock: StockLine[]): FulfillmentPlan {
  const stockBySku = new Map(stock.map((product) => [product.sku, product]));
  const missing = requested.filter((item) => !stockBySku.has(item.sku)).map((item) => item.sku);
  if (missing.length) throw new UnknownSkuError(missing);

  const lines = requested.map((item): FulfillmentLine => {
    const product = stockBySku.get(item.sku);
    if (!product) throw new UnknownSkuError([item.sku]);
    const fulfilledQuantity = Math.min(product.quantity, item.quantity);
    const backorderedQuantity = item.quantity - fulfilledQuantity;
    return {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      requestedQuantity: item.quantity,
      fulfilledQuantity,
      backorderedQuantity,
      stockBefore: product.quantity,
      stockAfter: product.quantity - fulfilledQuantity,
    };
  });

  const totalRequested = lines.reduce((total, item) => total + item.requestedQuantity, 0);
  const totalFulfilled = lines.reduce((total, item) => total + item.fulfilledQuantity, 0);
  const totalBackordered = totalRequested - totalFulfilled;
  const status: FulfillmentStatus =
    totalFulfilled === totalRequested
      ? "FULFILLED"
      : totalFulfilled === 0
        ? "BACKORDERED"
        : "PARTIALLY_FULFILLED";

  return { status, totalRequested, totalFulfilled, totalBackordered, lines };
}
