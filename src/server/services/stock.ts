import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { dateColumn, type LocalDate } from "@/server/domain/time";
import { getStoreStatus } from "./calendar";

export class StockError extends Error {
  constructor(public code: "OUT_OF_STOCK" | "NOT_FOUND") {
    super(code);
    this.name = "StockError";
  }
}

export type TodayMenuItem = {
  itemId: string;
  productId: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  qtyAvailable: number;
  paused: boolean;
  variants: { id: string; name: string; priceDeltaCents: number }[];
};

/** Cardápio de pronta entrega de hoje. `open` = cozinha aberta agora e cardápio ativo. */
export async function getTodayMenu(storeId: string, now: Date = new Date()): Promise<{ open: boolean; items: TodayMenuItem[] } | null> {
  const status = await getStoreStatus(storeId, now);
  const menu = await db.dailyMenu.findUnique({
    where: { storeId_date: { storeId, date: dateColumn(status.today) } },
    include: { items: { include: { product: { include: { variants: true } } }, orderBy: { product: { sortOrder: "asc" } } } },
  });
  if (!menu) return null;
  return {
    open: status.open && menu.status === "OPEN",
    items: menu.items
      .filter((i) => i.product.active)
      .map((i) => ({
        itemId: i.id,
        productId: i.productId,
        name: i.product.name,
        description: i.product.description,
        priceCents: i.product.priceCents,
        imageUrl: i.product.imageUrl,
        qtyAvailable: i.qtyAvailable,
        paused: i.paused,
        variants: i.product.variants.map((v) => ({ id: v.id, name: v.name, priceDeltaCents: v.priceDeltaCents })),
      })),
  };
}

/** Define a quantidade disponível de cada produto no cardápio da data (cria o cardápio se preciso). */
export async function upsertDailyMenu(storeId: string, date: LocalDate, items: { productId: string; qty: number }[], userId: string | null) {
  await db.$transaction(async (tx) => {
    const menu = await tx.dailyMenu.upsert({
      where: { storeId_date: { storeId, date: dateColumn(date) } },
      create: { storeId, date: dateColumn(date) },
      update: { status: "OPEN" },
    });
    for (const { productId, qty } of items) {
      const current = await tx.dailyMenuItem.findUnique({ where: { dailyMenuId_productId: { dailyMenuId: menu.id, productId } } });
      if (!current) {
        const item = await tx.dailyMenuItem.create({ data: { dailyMenuId: menu.id, productId, qtyInitial: qty, qtyAvailable: qty } });
        if (qty > 0) await tx.stockMovement.create({ data: { dailyMenuItemId: item.id, type: "IN", qty, reason: "cardápio do dia", userId } });
        continue;
      }
      const delta = qty - current.qtyAvailable;
      if (delta === 0) continue;
      await tx.dailyMenuItem.update({
        where: { id: current.id },
        data: { qtyAvailable: qty, qtyInitial: current.qtyInitial + Math.max(0, delta) },
      });
      await tx.stockMovement.create({
        data: { dailyMenuItemId: current.id, type: delta > 0 ? "IN" : "OUT", qty: Math.abs(delta), reason: "ajuste do cardápio", userId },
      });
    }
  });
}

/** Entrada (delta > 0) ou saída/perda (delta < 0) manual de estoque. */
export async function adjustStock(itemId: string, delta: number, type: "IN" | "OUT" | "LOSS", reason: string, userId: string | null) {
  await db.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE daily_menu_items SET qty_available = qty_available + ${delta},
        qty_initial = qty_initial + ${Math.max(0, delta)}
      WHERE id = ${itemId} AND qty_available + ${delta} >= 0`;
    if (updated !== 1) throw new StockError("OUT_OF_STOCK");
    await tx.stockMovement.create({ data: { dailyMenuItemId: itemId, type, qty: Math.abs(delta), reason, userId } });
  });
}

export async function setPaused(itemId: string, paused: boolean) {
  await db.dailyMenuItem.update({ where: { id: itemId }, data: { paused } });
}

/** Baixa atômica de estoque para uma venda. */
export async function decrementForSale(tx: Prisma.TransactionClient, itemId: string, qty: number, orderId: string | null) {
  const updated = await tx.$executeRaw`
    UPDATE daily_menu_items SET qty_available = qty_available - ${qty}
    WHERE id = ${itemId} AND NOT paused AND qty_available >= ${qty}`;
  if (updated !== 1) throw new StockError("OUT_OF_STOCK");
  await tx.stockMovement.create({ data: { dailyMenuItemId: itemId, type: "SALE", qty, orderId } });
}

/** Devolve ao estoque o que o pedido baixou (uma vez só por pedido). */
export async function restoreForCancel(tx: Prisma.TransactionClient, orderId: string) {
  const already = await tx.stockMovement.count({ where: { orderId, type: "CANCEL" } });
  if (already > 0) return;
  const sales = await tx.stockMovement.findMany({ where: { orderId, type: "SALE" } });
  for (const s of sales) {
    await tx.$executeRaw`UPDATE daily_menu_items SET qty_available = qty_available + ${s.qty} WHERE id = ${s.dailyMenuItemId}`;
    await tx.stockMovement.create({ data: { dailyMenuItemId: s.dailyMenuItemId, type: "CANCEL", qty: s.qty, orderId } });
  }
}

export async function closeDailyMenu(storeId: string, date: LocalDate) {
  await db.dailyMenu.updateMany({ where: { storeId, date: dateColumn(date) }, data: { status: "CLOSED" } });
}
