import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/server/domain/order-status";
import { addDays, dateColumn, todayIn, utcToLocalHHmm, zonedToUtc } from "@/server/domain/time";

export type KitchenCard = {
  id: string;
  code: string;
  status: OrderStatus;
  customer: string;
  type: "READY" | "SCHEDULED";
  fulfillment: "PICKUP" | "DELIVERY";
  createdAt: string;
  minutesAgo: number;
  /** horário de retirada/entrega da encomenda (HH:mm) */
  handoff: string | null;
  /** data da encomenda, quando não é hoje (DD/MM) */
  handoffDate: string | null;
  notes: string | null;
  district: string | null;
  items: { qty: number; name: string; notes: string | null }[];
};

export type KitchenBoard = {
  now: string;
  columns: { NEW: KitchenCard[]; TODO: KitchenCard[]; PREPARING: KitchenCard[]; READY: KitchenCard[] };
};

/** Pedidos que interessam à cozinha agora, separados por coluna (mais antigo primeiro). */
export async function kitchenBoard(storeId: string, now: Date = new Date()): Promise<KitchenBoard> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const today = todayIn(store.timezone, now);
  const startToday = zonedToUtc(today, "00:00", store.timezone);
  const startTomorrow = zonedToUtc(addDays(today, 1), "00:00", store.timezone);
  const isToday: Prisma.OrderWhereInput[] = [
    { type: "READY", createdAt: { gte: startToday, lt: startTomorrow } },
    { type: "SCHEDULED", scheduledDate: dateColumn(today) },
  ];

  const orders = await db.order.findMany({
    where: {
      storeId,
      OR: [
        { status: "AWAITING_CONFIRMATION" },
        { status: "PREPARING" },
        { status: { in: ["CONFIRMED", "READY", "OUT_FOR_DELIVERY"] }, OR: isToday },
      ],
    },
    include: { customer: { select: { name: true } }, items: { select: { qty: true, nameSnapshot: true, notes: true } } },
    orderBy: { createdAt: "asc" },
  });

  const toCard = (o: (typeof orders)[number]): KitchenCard => {
    const handoffDay = o.scheduledDate ? o.scheduledDate.toISOString().slice(0, 10) : null;
    const address = o.addressSnapshot as { district?: string } | null;
    return {
      id: o.id,
      code: o.code,
      status: o.status,
      customer: o.customer.name,
      type: o.type,
      fulfillment: o.fulfillment,
      createdAt: o.createdAt.toISOString(),
      minutesAgo: Math.max(0, Math.floor((now.getTime() - o.createdAt.getTime()) / 60_000)),
      handoff: o.handoffAt ? utcToLocalHHmm(o.handoffAt, store.timezone) : null,
      handoffDate: handoffDay && handoffDay !== today ? handoffDay.slice(5).split("-").reverse().join("/") : null,
      notes: o.notes,
      district: address?.district ?? null,
      items: o.items.map((i) => ({ qty: i.qty, name: i.nameSnapshot, notes: i.notes })),
    };
  };

  const byHandoff = (a: (typeof orders)[number], b: (typeof orders)[number]) =>
    (a.handoffAt ?? a.createdAt).getTime() - (b.handoffAt ?? b.createdAt).getTime();

  return {
    now: now.toISOString(),
    columns: {
      NEW: orders.filter((o) => o.status === "AWAITING_CONFIRMATION").map(toCard),
      TODO: orders.filter((o) => o.status === "CONFIRMED").sort(byHandoff).map(toCard),
      PREPARING: orders.filter((o) => o.status === "PREPARING").sort(byHandoff).map(toCard),
      READY: orders.filter((o) => o.status === "READY" || o.status === "OUT_FOR_DELIVERY").map(toCard),
    },
  };
}
