import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo1234", 12);
  const user = await db.user.upsert({
    where: { email: "demo@stockroom.app" },
    update: {},
    create: { name: "Alex Morgan", email: "demo@stockroom.app", passwordHash },
  });
  const products = [
    { sku: "TOTE-001", name: "Canvas utility tote", category: "Accessories", quantity: 4, lowStockThreshold: 12 },
    { sku: "BOX-440", name: "Archive storage box", category: "Storage", quantity: 86, lowStockThreshold: 20 },
    { sku: "TAPE-024", name: "Reinforced packing tape", category: "Packing", quantity: 0, lowStockThreshold: 18 },
    { sku: "LBL-105", name: "Thermal shipping labels", category: "Packing", quantity: 142, lowStockThreshold: 30 },
    { sku: "GLOVE-M", name: "Handling gloves - medium", category: "Safety", quantity: 9, lowStockThreshold: 15 },
  ];
  for (const product of products) {
    await db.product.upsert({
      where: { userId_sku: { userId: user.id, sku: product.sku } },
      update: product,
      create: { ...product, userId: user.id },
    });
  }
  console.log("Seeded demo@stockroom.app / Demo1234");
}

main().finally(() => db.$disconnect());
