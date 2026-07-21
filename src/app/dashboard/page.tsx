import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { InventoryDashboard } from "@/components/InventoryDashboard";

export const metadata: Metadata = { title: "Inventory" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const products = await db.product.findMany({ where: { userId: session.userId }, orderBy: { updatedAt: "desc" } });
  return <InventoryDashboard initialProducts={products.map((product) => ({ ...product, createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString() }))} user={session} />;
}
