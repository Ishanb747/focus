"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { firstValidationError, productSchema, type ProductInput } from "@/lib/validation";

interface Product extends ProductInput { id: string; createdAt: string; updatedAt: string; userId: string }
interface User { userId: string; name: string; email: string }
type Filter = "all" | "low" | "out";

const emptyProduct: ProductInput = { sku: "", name: "", quantity: 0, category: "", lowStockThreshold: 5 };

function Icon({ name }: { name: "grid" | "box" | "alert" | "plus" | "search" | "edit" | "trash" | "close" | "logout" }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
    alert: <><path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>, trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>, logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function InventoryDashboard({ initialProducts, user }: { initialProducts: Product[]; user: User }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const lowCount = products.filter((p) => p.quantity < p.lowStockThreshold).length;
  const outCount = products.filter((p) => p.quantity === 0).length;
  const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
  const visible = useMemo(() => products.filter((product) => {
    const matchesFilter = filter === "all" || (filter === "low" && product.quantity < product.lowStockThreshold) || (filter === "out" && product.quantity === 0);
    const query = search.trim().toLowerCase();
    return matchesFilter && (!query || [product.name, product.sku, product.category].some((value) => value.toLowerCase().includes(query)));
  }), [products, filter, search]);

  function openAdd() { setEditing(null); setForm(emptyProduct); setError(""); setModal("add"); }
  function openEdit(product: Product) { setEditing(product); setForm({ sku: product.sku, name: product.name, quantity: product.quantity, category: product.category, lowStockThreshold: product.lowStockThreshold }); setError(""); setModal("edit"); }
  function closeModal() { if (!saving) { setModal(null); setError(""); } }
  function announce(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3500); }

  async function submitProduct(event: FormEvent) {
    event.preventDefault(); setError("");
    const result = productSchema.safeParse(form);
    if (!result.success) { setError(firstValidationError(result.error)); return; }
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data) });
      const data = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !data.product) throw new Error(data.error ?? "Unable to save product");
      setProducts((current) => editing ? current.map((item) => item.id === data.product!.id ? data.product! : item) : [data.product!, ...current]);
      setModal(null); announce(editing ? "Product updated" : "Product added to inventory");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save product"); }
    finally { setSaving(false); }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    setDeletingId(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to delete product");
      setProducts((current) => current.filter((item) => item.id !== product.id)); announce("Product deleted");
    } catch (caught) { announce(caught instanceof Error ? caught.message : "Unable to delete product"); }
    finally { setDeletingId(null); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  const initials = user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a href="/dashboard" className="brand"><span className="brand-mark"><i/><i/><i/></span><span>stockroom</span></a>
        <nav><button className="active" onClick={() => setFilter("all")}><Icon name="grid"/>Overview</button><button onClick={() => setFilter("all")}><Icon name="box"/>All products<span>{products.length}</span></button><button onClick={() => setFilter("low")}><Icon name="alert"/>Low stock{lowCount > 0 && <span className="alert-count">{lowCount}</span>}</button></nav>
        <div className="sidebar-user"><span className="avatar">{initials}</span><div><b>{user.name}</b><small>{user.email}</small></div><button onClick={logout} title="Log out" aria-label="Log out"><Icon name="logout"/></button></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header"><div><p className="eyebrow"><span/>INVENTORY OVERVIEW</p><h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user.name.split(" ")[0]}.</h1><p>Here’s what’s happening in your stockroom today.</p></div><button className="button button-primary" onClick={openAdd}><Icon name="plus"/>Add product</button></header>

        <section className="metrics">
          <article><span className="metric-icon"><Icon name="box"/></span><div><small>TOTAL PRODUCTS</small><strong>{products.length.toLocaleString()}</strong><p>Across {new Set(products.map((p) => p.category)).size} categories</p></div></article>
          <article><span className="metric-icon"><Icon name="grid"/></span><div><small>TOTAL UNITS</small><strong>{totalUnits.toLocaleString()}</strong><p>Currently in stock</p></div></article>
          <article className={lowCount ? "warning" : ""}><span className="metric-icon"><Icon name="alert"/></span><div><small>NEEDS ATTENTION</small><strong>{lowCount}</strong><p>{outCount ? `${outCount} completely out of stock` : "No products are out of stock"}</p></div></article>
        </section>

        {lowCount > 0 && <button className="alert-banner" onClick={() => setFilter("low")}><span><Icon name="alert"/></span><div><b>{lowCount} {lowCount === 1 ? "product is" : "products are"} running low</b><small>Review these items before they run out.</small></div><strong>View low stock →</strong></button>}

        <section className="inventory-card">
          <div className="inventory-toolbar"><div><h2>Products</h2><p>{visible.length} {visible.length === 1 ? "item" : "items"} shown</p></div><div className="toolbar-actions"><div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "low" ? "active" : ""} onClick={() => setFilter("low")}>Low stock</button><button className={filter === "out" ? "active" : ""} onClick={() => setFilter("out")}>Out of stock</button></div><label className="search"><Icon name="search"/><input aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…"/></label></div></div>
          {visible.length ? <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>ON HAND</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((product) => { const low = product.quantity < product.lowStockThreshold; const out = product.quantity === 0; return <tr key={product.id}><td><div className="product-cell"><span>{product.name.slice(0,1).toUpperCase()}</span><div><b>{product.name}</b><small>Updated {new Intl.DateTimeFormat("en", { month:"short", day:"numeric" }).format(new Date(product.updatedAt))}</small></div></div></td><td><code>{product.sku}</code></td><td><span className="category-pill">{product.category}</span></td><td><b>{product.quantity.toLocaleString()}</b><small className="threshold">Min. {product.lowStockThreshold}</small></td><td><span className={`status ${out ? "out" : low ? "low" : "healthy"}`}><i/>{out ? "Out of stock" : low ? "Low stock" : "In stock"}</span></td><td><div className="row-actions"><button onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}><Icon name="edit"/></button><button className="danger-action" disabled={deletingId === product.id} onClick={() => deleteProduct(product)} aria-label={`Delete ${product.name}`}>{deletingId === product.id ? <span className="spinner dark"/> : <Icon name="trash"/>}</button></div></td></tr>; })}</tbody></table></div> : <div className="empty-state"><span><Icon name="box"/></span><h3>{products.length ? "No products match" : "Your stockroom is ready"}</h3><p>{products.length ? "Try another search or filter." : "Add your first product to start tracking inventory."}</p>{!products.length && <button className="button button-primary" onClick={openAdd}><Icon name="plus"/>Add your first product</button>}</div>}
        </section>
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><header><div><p className="auth-kicker">{modal === "add" ? "NEW INVENTORY" : "UPDATE INVENTORY"}</p><h2 id="product-modal-title">{modal === "add" ? "Add a product" : "Edit product"}</h2></div><button onClick={closeModal} aria-label="Close"><Icon name="close"/></button></header><form onSubmit={submitProduct} noValidate><div className="form-grid"><label className="wide"><span>Product name</span><input autoFocus value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} placeholder="e.g. Canvas utility tote" disabled={saving}/></label><label><span>SKU</span><input value={form.sku} onChange={(e) => setForm({...form, sku:e.target.value})} placeholder="TOTE-001" disabled={saving}/></label><label><span>Category</span><input value={form.category} onChange={(e) => setForm({...form, category:e.target.value})} placeholder="Accessories" disabled={saving}/></label><label><span>Quantity on hand</span><input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({...form, quantity:Number(e.target.value)})} disabled={saving}/></label><label><span>Low-stock threshold</span><input type="number" min="0" step="1" value={form.lowStockThreshold} onChange={(e) => setForm({...form, lowStockThreshold:Number(e.target.value)})} disabled={saving}/><small>Flag when quantity falls below this number.</small></label></div>{error && <div className="form-error" role="alert"><span>!</span>{error}</div>}<footer><button type="button" className="button button-ghost" onClick={closeModal} disabled={saving}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? <><span className="spinner"/>Saving…</> : modal === "add" ? "Add product" : "Save changes"}</button></footer></form></section></div>}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
