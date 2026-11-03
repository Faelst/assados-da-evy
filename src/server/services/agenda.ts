import "server-only";
import { db } from "@/server/db";
import type { OrderStatus } from "@/server/domain/order-status";
import { addDays, dateColumn, fromDateColumn, utcToLocalHHmm, weekdayOf, type LocalDate } from "@/server/domain/time";
import { ensureBatches } from "./batches";

/** Segunda-feira da semana da data. */
export function weekStartOf(date: LocalDate): LocalDate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export type AgendaOrder = {
  orderId: string;
  code: string;
  customer: string;
  phone: string;
  units: number;
  items: string;
  status: OrderStatus;
  fulfillment: "PICKUP" | "DELIVERY";
};
export type AgendaBatch = {
  id: string;
  productName: string;
  start: string;
  end: string;
  usedUnits: number;
  heldUnits: number;
  capacityUnits: number;
  blocked: boolean;
  orders: AgendaOrder[];
};
export type AgendaDay = { date: LocalDate; batches: AgendaBatch[] };

export async function weekAgenda(storeId: string, weekStart: LocalDate): Promise<AgendaDay[]> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const end = addDays(weekStart, 6);
  await ensureBatches(storeId, weekStart, end);
  const batches = await db.productionBatch.findMany({
    where: { storeId, date: { gte: dateColumn(weekStart), lte: dateColumn(end) } },
    include: {
      product: { select: { name: true } },
      orderItems: { include: { orderItem: { include: { order: { include: { customer: true } } } } } },
    },
    orderBy: { startsAt: "asc" },
  });

  const days: AgendaDay[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(weekStart, i), batches: [] }));
  for (const b of batches) {
    const day = days.find((d) => d.date === fromDateColumn(b.date));
    if (!day) continue;
    const byOrder = new Map<string, AgendaOrder>();
    for (const a of b.orderItems) {
      const o = a.orderItem.order;
      if (o.status === "CANCELLED") continue;
      const existing = byOrder.get(o.id);
      const line = `${a.orderItem.qty}× ${a.orderItem.nameSnapshot}`;
      if (existing) {
        existing.units += a.units;
        if (!existing.items.includes(line)) existing.items += `, ${line}`;
      } else {
        byOrder.set(o.id, {
          orderId: o.id,
          code: o.code,
          customer: o.customer.name,
          phone: o.customer.phone,
          units: a.units,
          items: line,
          status: o.status,
          fulfillment: o.fulfillment,
        });
      }
    }
    day.batches.push({
      id: b.id,
      productName: b.product.name,
      start: utcToLocalHHmm(b.startsAt, store.timezone),
      end: utcToLocalHHmm(b.readyAt, store.timezone),
      usedUnits: b.usedUnits,
      heldUnits: b.heldUnits,
      capacityUnits: b.capacityUnits,
      blocked: b.blocked,
      orders: [...byOrder.values()],
    });
  }
  return days;
}

export type ProductionLine = {
  productId: string;
  productName: string;
  totalUnits: number;
  batches: { start: string; ready: string; units: number }[];
};

/** O que produzir no dia: unidades vendidas por receita e fornada. */
export async function productionDay(storeId: string, date: LocalDate): Promise<ProductionLine[]> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const batches = await db.productionBatch.findMany({
    where: { storeId, date: dateColumn(date), usedUnits: { gt: 0 } },
    include: { product: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
  });
  const lines = new Map<string, ProductionLine>();
  for (const b of batches) {
    const line = lines.get(b.productId) ?? { productId: b.productId, productName: b.product.name, totalUnits: 0, batches: [] };
    line.totalUnits += b.usedUnits;
    line.batches.push({ start: utcToLocalHHmm(b.startsAt, store.timezone), ready: utcToLocalHHmm(b.readyAt, store.timezone), units: b.usedUnits });
    lines.set(b.productId, line);
  }
  return [...lines.values()];
}
