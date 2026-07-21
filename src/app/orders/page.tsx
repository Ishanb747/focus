import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrdersDashboard } from "@/components/OrdersDashboard";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderInclude } from "@/lib/order-service";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [products, orders] = await Promise.all([
    db.product.findMany({ where: { userId: session.userId }, orderBy: { name: "asc" } }),
    db.order.findMany({ where: { userId: session.userId }, include: orderInclude, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <OrdersDashboard
      user={session}
      initialProducts={products.map((product) => ({ ...product, createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString() }))}
      initialOrders={orders.map((order) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
        auditEvents: order.auditEvents.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
      }))}
    />
  );
}
