import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoutingDashboard } from "@/components/RoutingDashboard";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Rate & Routing" };

export default async function RoutingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [products, orderCount, quotes] = await Promise.all([
    db.product.findMany({ where: { userId: session.userId }, select: { quantity: true, lowStockThreshold: true } }),
    db.order.count({ where: { userId: session.userId } }),
    db.deliveryQuote.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <RoutingDashboard
      user={session}
      productCount={products.length}
      lowStockCount={products.filter((product) => product.quantity < product.lowStockThreshold).length}
      orderCount={orderCount}
      initialQuotes={quotes.map((quote) => ({ ...quote, createdAt: quote.createdAt.toISOString() }))}
    />
  );
}
