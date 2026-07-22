"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface SidebarUser {
  name: string;
  email: string;
}

interface AppSidebarProps {
  user: SidebarUser;
  active: "inventory" | "orders" | "routing";
  productCount: number;
  lowStockCount: number;
  orderCount?: number;
  quoteCount?: number;
  onInventoryFilter?: (filter: "all" | "low") => void;
}

function NavIcon({ name }: { name: "grid" | "box" | "alert" | "orders" | "route" | "logout" }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
    alert: <><path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    orders: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h1"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function AppSidebar({ user, active, productCount, lowStockCount, orderCount = 0, quoteCount = 0, onInventoryFilter }: AppSidebarProps) {
  const router = useRouter();
  const initials = user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  function openInventory(filter: "all" | "low") {
    if (active === "inventory") onInventoryFilter?.(filter);
    else router.push(filter === "low" ? "/dashboard?filter=low" : "/dashboard");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><span className="brand-mark"><i/><i/><i/></span><span>stockroom</span></Link>
      <nav>
        <button className={active === "inventory" ? "active" : ""} onClick={() => openInventory("all")}><NavIcon name="grid"/>Overview</button>
        <button onClick={() => openInventory("all")}><NavIcon name="box"/>All products<span>{productCount}</span></button>
        <button onClick={() => openInventory("low")}><NavIcon name="alert"/>Low stock{lowStockCount > 0 && <span className="alert-count">{lowStockCount}</span>}</button>
        <button className={active === "orders" ? "active" : ""} onClick={() => router.push("/orders")}><NavIcon name="orders"/>Orders<span>{orderCount}</span></button>
        <button className={active === "routing" ? "active" : ""} onClick={() => router.push("/routing")}><NavIcon name="route"/>Rate &amp; routing<span>{quoteCount}</span></button>
      </nav>
      <div className="sidebar-user"><span className="avatar">{initials}</span><div><b>{user.name}</b><small>{user.email}</small></div><button onClick={logout} title="Log out" aria-label="Log out"><NavIcon name="logout"/></button></div>
    </aside>
  );
}
