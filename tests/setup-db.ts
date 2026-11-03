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
