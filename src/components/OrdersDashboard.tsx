"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { firstValidationError, orderSchema } from "@/lib/validation";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  id: string;
  sku: string;
  productName: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  backorderedQuantity: number;
  createdAt: string;
}

interface AuditEvent {
  id: string;
  action: "ORDER_CREATED" | "STOCK_DEDUCTED" | "ITEM_BACKORDERED";
  message: string;
  details: unknown;
  createdAt: string;
}

interface Order {
  id: string;
  status: "FULFILLED" | "PARTIALLY_FULFILLED" | "BACKORDERED";
  totalRequested: number;
  totalFulfilled: number;
  totalBackordered: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  auditEvents: AuditEvent[];
}

interface User { userId: string; name: string; email: string }
interface DraftLine { sku: string; quantity: number }

function OrderIcon({ name }: { name: "plus" | "orders" | "trash" | "check" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14"/>,
    orders: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function statusLabel(status: Order["status"]) {
  if (status === "PARTIALLY_FULFILLED") return "Partially fulfilled";
  if (status === "BACKORDERED") return "Backordered";
  return "Fulfilled";
}

export function OrdersDashboard({ initialProducts, initialOrders, quoteCount, user }: { initialProducts: Product[]; initialOrders: Order[]; quoteCount: number; user: User }) {
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [composerOpen, setComposerOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([{ sku: initialProducts[0]?.sku ?? "", quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const lowStockCount = products.filter((product) => product.quantity < product.lowStockThreshold).length;
  const fulfilledUnits = orders.reduce((total, order) => total + order.totalFulfilled, 0);
  const backorderedUnits = orders.reduce((total, order) => total + order.totalBackordered, 0);
  const availableSkus = useMemo(() => new Set(products.map((product) => product.sku)), [products]);

  function openComposer() {
    setLines([{ sku: products[0]?.sku ?? "", quantity: 1 }]);
    setError("");
    setComposerOpen(true);
  }

  function addLine() {
    const selected = new Set(lines.map((line) => line.sku));
    const next = products.find((product) => !selected.has(product.sku));
    setLines((current) => [...current, { sku: next?.sku ?? "", quantity: 1 }]);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = orderSchema.safeParse({ items: lines });
    if (!result.success) { setError(firstValidationError(result.error)); return; }
    if (result.data.items.some((item) => !availableSkus.has(item.sku))) { setError("Select a valid product for every line"); return; }

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data) });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error ?? "Unable to create order");
      setOrders((current) => [data.order!, ...current]);
      setProducts((current) => current.map((product) => {
        const item = data.order!.items.find((line) => line.sku === product.sku);
        return item ? { ...product, quantity: product.quantity - item.fulfilledQuantity } : product;
      }));
      setComposerOpen(false);
      setNotice(`${statusLabel(data.order.status)} order created`);
      window.setTimeout(() => setNotice(""), 4000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <AppSidebar user={user} active="orders" productCount={products.length} lowStockCount={lowStockCount} orderCount={orders.length} quoteCount={quoteCount} />
      <section className="dashboard-main orders-main">
        <header className="dashboard-header">
          <div><p className="eyebrow"><span/>ORDER FULFILLMENT</p><h1>Orders</h1><p>Create multi-SKU orders with atomic stock deduction and automatic backorders.</p></div>
          <button className="button button-primary" onClick={openComposer} disabled={!products.length}><OrderIcon name="plus"/>New order</button>
        </header>

        <section className="metrics order-metrics">
          <article><span className="metric-icon"><OrderIcon name="orders"/></span><div><small>TOTAL ORDERS</small><strong>{orders.length}</strong><p>Immutable order history</p></div></article>
          <article><span className="metric-icon"><OrderIcon name="check"/></span><div><small>UNITS FULFILLED</small><strong>{fulfilledUnits}</strong><p>Deducted atomically</p></div></article>
          <article className={backorderedUnits ? "warning" : ""}><span className="metric-icon"><OrderIcon name="orders"/></span><div><small>UNITS BACKORDERED</small><strong>{backorderedUnits}</strong><p>Awaiting future stock</p></div></article>
        </section>

        {composerOpen && <section className="order-composer">
          <div className="order-section-head"><div><p className="auth-kicker">NEW ORDER</p><h2>Request inventory</h2><p>Available stock is fulfilled now; any remainder is safely backordered.</p></div><button className="button button-ghost" onClick={() => !submitting && setComposerOpen(false)}>Cancel</button></div>
          <form onSubmit={submitOrder} noValidate>
            <div className="order-lines">
              {lines.map((line, index) => <div className="order-line" key={`${index}-${line.sku}`}>
                <label><span>Product</span><select aria-label={`Product for line ${index + 1}`} value={line.sku} onChange={(event) => updateLine(index, { sku: event.target.value })} disabled={submitting}><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.sku}>{product.name} · {product.sku} · {product.quantity} available</option>)}</select></label>
                <label><span>Quantity</span><input aria-label={`Quantity for line ${index + 1}`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} disabled={submitting}/></label>
                <button type="button" className="line-remove" aria-label={`Remove line ${index + 1}`} onClick={() => removeLine(index)} disabled={submitting || lines.length === 1}><OrderIcon name="trash"/></button>
              </div>)}
            </div>
            {lines.length < Math.min(products.length, 50) && <button type="button" className="add-line" onClick={addLine} disabled={submitting}><OrderIcon name="plus"/>Add another SKU</button>}
            {error && <div className="form-error" role="alert"><span>!</span>{error}</div>}
            <footer><button className="button button-primary" disabled={submitting}>{submitting ? <><span className="spinner"/>Fulfilling order…</> : "Create and fulfill order"}</button></footer>
          </form>
        </section>}

        {!products.length && <section className="orders-empty products-required"><span><OrderIcon name="orders"/></span><h2>Add inventory before creating orders</h2><p>Orders reference your product SKUs and current stock.</p><Link className="button button-primary" href="/dashboard">Open inventory</Link></section>}

        <section className="orders-history">
          <div className="order-section-head"><div><h2>Order history</h2><p>{orders.length} {orders.length === 1 ? "order" : "orders"}, newest first</p></div></div>
          {orders.length ? <div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}>
            <header><div><p>ORDER #{order.id.slice(-8).toUpperCase()}</p><time dateTime={order.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</time></div><span className={`order-status ${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span></header>
            <div className="order-summary"><div><small>REQUESTED</small><b>{order.totalRequested}</b></div><div><small>FULFILLED</small><b>{order.totalFulfilled}</b></div><div><small>BACKORDERED</small><b>{order.totalBackordered}</b></div></div>
            <div className="order-items"><div className="order-item order-item-head"><span>ITEM</span><span>REQUESTED</span><span>FULFILLED</span><span>BACKORDERED</span></div>{order.items.map((item) => <div className="order-item" key={item.id}><span><b>{item.productName}</b><code>{item.sku}</code></span><span>{item.requestedQuantity}</span><span className="fulfilled-number">{item.fulfilledQuantity}</span><span className={item.backorderedQuantity ? "backordered-number" : ""}>{item.backorderedQuantity}</span></div>)}</div>
            <details className="audit-log"><summary>Audit log · {order.auditEvents.length} events</summary><ol>{order.auditEvents.map((event) => <li key={event.id}><i className={event.action.toLowerCase()}/><div><b>{event.message}</b><time>{new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format(new Date(event.createdAt))}</time></div></li>)}</ol></details>
          </article>)}</div> : products.length > 0 && <div className="orders-empty"><span><OrderIcon name="orders"/></span><h2>No orders yet</h2><p>Create a multi-SKU order to see fulfillment and audit details here.</p><button className="button button-primary" onClick={openComposer}>Create your first order</button></div>}
        </section>
      </section>
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
