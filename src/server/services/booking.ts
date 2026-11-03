import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { allocate, isBookable } from "@/server/domain/allocation";
import { addDays, todayIn, utcToLocalHHmm, type LocalDate } from "@/server/domain/time";
import { ensureBatches, listDayBatches, releaseExpiredHolds, type BatchView } from "./batches";

export class BookingError extends Error {
  constructor(public code: "HOLD_EXPIRED" | "UNAVAILABLE") {
    super(code);
    this.name = "BookingError";
  }
}

export type CartLine = { productId: string; qty: number };
export type DateStatus = "AVAILABLE" | "FEW" | "SOLD_OUT" | "CLOSED";

async function loadProducts(storeId: string, ids: string[]) {
  const products = await db.product.findMany({ where: { storeId, id: { in: ids } } });
  return new Map(products.map((p) => [p.id, p]));
}

async function toUnits(storeId: string, lines: CartLine[]) {
  const products = await loadProducts(storeId, [...new Set(lines.map((l) => l.productId))]);
  const lead: Record<string, number> = {};
  const units = lines.map((l) => {
    const p = products.get(l.productId);
    if (!p || !p.active || !p.saleModes.includes("SCHEDULED")) throw new BookingError("UNAVAILABLE");
    lead[p.id] = p.leadTimeHours;
    return { productId: p.id, units: l.qty * p.productionUnits };
  });
  return { units, lead };
}

/** Horários de retirada/entrega do dia (um por horário de "pronto" das fornadas). */
export async function availableHandoffs(
  storeId: string,
  date: LocalDate,
  lines: CartLine[],
  now: Date = new Date(),
): Promise<{ at: Date; label: string; available: boolean }[]> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  await releaseExpiredHolds(now);
  await ensureBatches(storeId, date, date);
  const batches = await listDayBatches(storeId, date);
  let units: { productId: string; units: number }[] = [];
  let lead: Record<string, number> = {};
  try {
    ({ units, lead } = await toUnits(storeId, lines));
  } catch {
    return [];
  }
  const productIds = new Set(units.map((u) => u.productId));
  const times = [...new Set(batches.filter((b) => productIds.has(b.productId)).map((b) => b.readyAt.getTime()))].sort();
  return times.map((t) => {
    const at = new Date(t);
    return {
      at,
      label: utcToLocalHHmm(at, store.timezone),
      available: units.length > 0 && allocate(units, batches, at, now, lead) !== null,
    };
  });
}

function dayStatus(batches: BatchView[], now: Date, lead: Map<string, number>): DateStatus {
  if (batches.length === 0) return "CLOSED";
  const bookable = batches.filter((b) => isBookable(b, now, lead.get(b.productId) ?? 0));
  const capacity = bookable.reduce((s, b) => s + b.capacityUnits, 0);
  const free = bookable.reduce((s, b) => s + b.freeUnits, 0);
  if (free <= 0) return "SOLD_OUT";
  return free < capacity * 0.2 ? "FEW" : "AVAILABLE";
}

/** Disponibilidade dos próximos dias dentro da janela de agenda. */
export async function availableDates(storeId: string, now: Date = new Date()): Promise<{ date: LocalDate; status: DateStatus }[]> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  await releaseExpiredHolds(now);
  const today = todayIn(store.timezone, now);
  const last = addDays(today, store.bookingWindowDays);
  await ensureBatches(storeId, today, last);
  const products = await db.product.findMany({ where: { storeId }, select: { id: true, leadTimeHours: true } });
  const lead = new Map(products.map((p) => [p.id, p.leadTimeHours]));
  const out: { date: LocalDate; status: DateStatus }[] = [];
  for (let d = today; d <= last; d = addDays(d, 1)) {
    out.push({ date: d, status: dayStatus(await listDayBatches(storeId, d), now, lead) });
  }
  return out;
}

/**
 * Reserva as vagas do carrinho por `store.holdMinutes`. Substitui reservas anteriores
 * da mesma sessão. Cada incremento é condicional, então duas sessões nunca levam a mesma vaga.
 */
export async function holdBooking(
  storeId: string,
  sessionId: string,
  date: LocalDate,
  lines: CartLine[],
  handoffAt: Date,
  now: Date = new Date(),
): Promise<{ holdIds: string[]; expiresAt: Date } | { error: "UNAVAILABLE" }> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  await releaseExpiredHolds(now);
  await ensureBatches(storeId, date, date);
  let prepared;
  try {
    prepared = await toUnits(storeId, lines);
  } catch {
    return { error: "UNAVAILABLE" };
  }
  const expiresAt = new Date(now.getTime() + store.holdMinutes * 60_000);

  try {
    const holdIds = await db.$transaction(async (tx) => {
      await releaseSessionHolds(tx, sessionId);
      const batches = (await listDayBatchesTx(tx, storeId, date)).map((b) => ({
        ...b,
        freeUnits: Math.max(0, b.capacityUnits - b.usedUnits - b.heldUnits),
      }));
      const allocation = allocate(prepared.units, batches, handoffAt, now, prepared.lead);
      if (!allocation) throw new BookingError("UNAVAILABLE");
      const ids: string[] = [];
      for (const a of allocation) {
        const updated = await tx.$executeRaw`
          UPDATE production_batches SET held_units = held_units + ${a.units}
          WHERE id = ${a.batchId} AND NOT blocked AND capacity_units - used_units - held_units >= ${a.units}`;
        if (updated !== 1) throw new BookingError("UNAVAILABLE");
        const hold = await tx.batchHold.create({ data: { batchId: a.batchId, sessionId, units: a.units, expiresAt } });
        ids.push(hold.id);
      }
      return ids;
    });
    return { holdIds, expiresAt };
  } catch (e) {
    if (e instanceof BookingError) return { error: "UNAVAILABLE" };
    // conflito de serialização / violação do CHECK em corrida também significa "sem vaga"
    if (isConstraintError(e)) return { error: "UNAVAILABLE" };
    throw e;
  }
}

function isConstraintError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /check constraint|could not serialize|deadlock/i.test(msg);
}

async function listDayBatchesTx(tx: Prisma.TransactionClient, storeId: string, date: LocalDate) {
  // trava as fornadas do dia para que reservas simultâneas sejam serializadas
  await tx.$queryRaw`SELECT id FROM production_batches WHERE store_id = ${storeId} AND date = ${date}::date FOR UPDATE`;
  const rows = await tx.productionBatch.findMany({
    where: { storeId, date: new Date(`${date}T00:00:00Z`) },
    orderBy: { startsAt: "asc" },
  });
  return rows;
}

export async function releaseSessionHolds(tx: Prisma.TransactionClient, sessionId: string) {
  const holds = await tx.batchHold.findMany({ where: { sessionId } });
  for (const h of holds) {
    await tx.$executeRaw`UPDATE production_batches SET held_units = held_units - ${h.units} WHERE id = ${h.batchId}`;
  }
  await tx.batchHold.deleteMany({ where: { sessionId } });
}

/**
 * Converte as reservas válidas da sessão em vagas usadas, gravando a alocação de cada item.
 * Lança HOLD_EXPIRED se as reservas não cobrem os itens.
 */
export async function consumeHolds(
  tx: Prisma.TransactionClient,
  sessionId: string,
  orderItems: { id: string; productId: string; qty: number }[],
  now: Date = new Date(),
): Promise<void> {
  const holds = await tx.batchHold.findMany({
    where: { sessionId, expiresAt: { gt: now } },
    include: { batch: { select: { productId: true, readyAt: true } } },
    orderBy: { batch: { readyAt: "desc" } },
  });
  const products = await tx.product.findMany({
    where: { id: { in: [...new Set(orderItems.map((i) => i.productId))] } },
    select: { id: true, productionUnits: true },
  });
  const unitsOf = new Map(products.map((p) => [p.id, p.productionUnits]));
  const remaining = new Map(holds.map((h) => [h.id, h.units]));

  for (const item of orderItems) {
    let need = item.qty * (unitsOf.get(item.productId) ?? 1);
    for (const h of holds) {
      if (need <= 0) break;
      if (h.batch.productId !== item.productId) continue;
      const take = Math.min(need, remaining.get(h.id) ?? 0);
      if (take <= 0) continue;
      remaining.set(h.id, (remaining.get(h.id) ?? 0) - take);
      need -= take;
      await tx.$executeRaw`
        UPDATE production_batches SET held_units = held_units - ${take}, used_units = used_units + ${take}
        WHERE id = ${h.batchId}`;
      await tx.orderItemBatch.create({ data: { orderItemId: item.id, batchId: h.batchId, units: take } });
    }
    if (need > 0) throw new BookingError("HOLD_EXPIRED");
  }

  // sobra de reserva (carrinho diminuiu) volta para a fornada
  for (const h of holds) {
    const left = remaining.get(h.id) ?? 0;
    if (left > 0) await tx.$executeRaw`UPDATE production_batches SET held_units = held_units - ${left} WHERE id = ${h.batchId}`;
  }
  await tx.batchHold.deleteMany({ where: { id: { in: holds.map((h) => h.id) } } });
}
