import "server-only";
import { connection } from "next/server";
import { db } from "@/server/db";

export const STORE_SLUG = process.env.STORE_SLUG ?? "assados-da-evy";

/** A loja (única por enquanto). Marca a renderização como dinâmica. */
export async function getStore() {
  await connection();
  const store = await db.store.findUnique({ where: { slug: STORE_SLUG } });
  if (!store) throw new Error(`Loja "${STORE_SLUG}" não encontrada. Rode npm run db:seed.`);
  return store;
}
