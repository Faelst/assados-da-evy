import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export async function resetDb() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function seedStore(overrides: Partial<Prisma.StoreCreateInput> = {}) {
  return db.store.create({
    data: {
      name: "Loja Teste",
      slug: "loja-teste",
      whatsapp: "5511999999999",
      paymentMethods: ["PIX", "CASH", "CARD"],
      ...overrides,
    },
  });
}

export async function seedProduct(storeId: string, overrides: Partial<Prisma.ProductUncheckedCreateInput> = {}) {
  return db.product.create({
    data: {
      storeId,
      name: "Panetone",
      priceCents: 5000,
      saleModes: ["SCHEDULED"],
      batchSize: 10,
      batchDurationMin: 180,
      leadTimeHours: 24,
      ...overrides,
    },
  });
}

/** Loja aberta de segunda a sábado, 08:00–18:00. */
export async function seedHours(storeId: string) {
  await db.businessHour.createMany({
    data: [1, 2, 3, 4, 5, 6].map((weekday) => ({ storeId, weekday, opensAt: "08:00", closesAt: "18:00" })),
  });
}
