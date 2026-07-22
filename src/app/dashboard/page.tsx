import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { InventoryDashboard } from "@/components/InventoryDashboard";

export const metadata: Metadata = { title: "Inventory" };

export default async function DashboardPage({ searchParams }: { searchParams: { filter?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [products, orderCount, quoteCount] = await Promise.all([
    db.product.findMany({ where: { userId: session.userId }, orderBy: { updatedAt: "desc" } }),
    db.order.count({ where: { userId: session.userId } }),
    db.deliveryQuote.count({ where: { userId: session.userId } }),
  ]);
  return (
    <InventoryDashboard
      initialProducts={products.map((product) => ({ ...product, createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString() }))}
      initialFilter={searchParams.filter === "low" ? "low" : "all"}
      orderCount={orderCount}
      quoteCount={quoteCount}
      user={session}
    />
  );
}
