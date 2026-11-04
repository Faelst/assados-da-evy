import "server-only";
import { db } from "@/server/db";
import type { ProductionBatch } from "@/generated/prisma/client";
import { resolveDay } from "@/server/domain/production";
import { addDays, dateColumn, fromDateColumn, todayIn, weekdayOf, zonedToUtc, type LocalDate } from "@/server/domain/time";

export type BatchView = {
  id: string;
  productId: string;
  productName: string;
  date: LocalDate;
  startsAt: Date;
  readyAt: Date;
  capacityUnits: number;
  usedUnits: number;
  heldUnits: number;
  freeUnits: number;
  blocked: boolean;
  manual: boolean;
};

/** Devolve às fornadas as unidades de reservas vencidas e apaga as reservas. */
export async function releaseExpiredHolds(now: Date = new Date()): Promise<number> {
  return db.$transaction(async (tx) => {
    // DELETE … RETURNING reivindica cada reserva uma vez só, mesmo com chamadas simultâneas
    const expired = await tx.$queryRaw<{ batch_id: string; units: number }[]>`
      DELETE FROM batch_holds WHERE expires_at <= ${now} RETURNING batch_id, units`;
    for (const h of expired) {
      await tx.$executeRaw`UPDATE production_batches SET held_units = held_units - ${h.units} WHERE id = ${h.batch_id}`;
    }
    return expired.length;
  });
}

function keyOf(productId: string, startsAt: Date) {
  return `${productId}@${startsAt.toISOString()}`;
}

/**
 * Sincroniza as fornadas de cada data do intervalo com o plano (semana + exceções).
 * Cria as que faltam; apaga as automáticas que saíram do plano e não têm vendas
 * nem reservas; devolve como conflito as que saíram do plano mas já têm vendas.
 */
async function syncRange(storeId: string, from: LocalDate, to: LocalDate): Promise<ProductionBatch[]> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const [hours, plan, products, exceptions] = await Promise.all([
    db.businessHour.findMany({ where: { storeId } }),
    db.weeklyBatchPlan.findMany({ where: { storeId, product: { active: true } } }),
    db.product.findMany({ where: { storeId } }),
    db.calendarException.findMany({
      where: { storeId, date: { gte: dateColumn(from), lte: dateColumn(to) } },
      include: { plan: true },
    }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const durations = Object.fromEntries(products.map((p) => [p.id, p.batchDurationMin]));
  const conflicts: ProductionBatch[] = [];

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const ex = exceptions.find((e) => fromDateColumn(e.date) === date);
    const day = resolveDay({
      weekday: weekdayOf(date),
      hours,
      plan,
      durations,
      exception: ex
        ? { type: ex.type, opensAt: ex.opensAt, closesAt: ex.closesAt, plan: ex.plan.filter((p) => productById.get(p.productId)?.active) }
        : null,
    });

    const desired = day.plan
      .map((p) => {
        const product = productById.get(p.productId);
        if (!product || !product.saleModes.includes("SCHEDULED")) return null;
        const startsAt = zonedToUtc(date, p.startTime, store.timezone);
        const readyAt = new Date(startsAt.getTime() + product.batchDurationMin * 60_000);
        return { productId: product.id, startsAt, readyAt, capacityUnits: product.batchSize };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const existing = await db.productionBatch.findMany({ where: { storeId, date: dateColumn(date) } });
    const existingKeys = new Set(existing.map((b) => keyOf(b.productId, b.startsAt)));
    const desiredKeys = new Set(desired.map((d) => keyOf(d.productId, d.startsAt)));

    for (const b of existing) {
      if (b.manual || desiredKeys.has(keyOf(b.productId, b.startsAt))) continue;
      if (b.usedUnits > 0 || b.heldUnits > 0) {
        conflicts.push(b);
        continue;
      }
      // condicional: outra requisição pode ter apagado ou reservado a fornada nesse meio-tempo
      const removed = await db.productionBatch.deleteMany({ where: { id: b.id, manual: false, usedUnits: 0, heldUnits: 0 } });
      if (removed.count === 0) {
        const still = await db.productionBatch.findUnique({ where: { id: b.id } });
        if (still) conflicts.push(still);
      }
    }

    const missing = desired.filter((d) => !existingKeys.has(keyOf(d.productId, d.startsAt)));
    if (missing.length) {
      await db.productionBatch.createMany({
        data: missing.map((d) => ({ storeId, date: dateColumn(date), ...d })),
        skipDuplicates: true,
      });
    }
  }
  return conflicts;
}

export async function ensureBatches(storeId: string, from: LocalDate, to: LocalDate): Promise<void> {
  await syncRange(storeId, from, to);
}

/** Recalcula as fornadas de hoje até o fim da janela de agenda. */
export async function regenerateFuture(storeId: string, now: Date = new Date()): Promise<{ conflicts: ProductionBatch[] }> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  await releaseExpiredHolds(now);
  const today = todayIn(store.timezone, now);
  const conflicts = await syncRange(storeId, today, addDays(today, store.bookingWindowDays));
  return { conflicts };
}

export async function listDayBatches(storeId: string, date: LocalDate): Promise<BatchView[]> {
  const rows = await db.productionBatch.findMany({
    where: { storeId, date: dateColumn(date) },
    include: { product: { select: { name: true } } },
    orderBy: [{ startsAt: "asc" }],
  });
  return rows.map(toView);
}

export function toView(b: ProductionBatch & { product: { name: string } }): BatchView {
  return {
    id: b.id,
    productId: b.productId,
    productName: b.product.name,
    date: fromDateColumn(b.date),
    startsAt: b.startsAt,
    readyAt: b.readyAt,
    capacityUnits: b.capacityUnits,
    usedUnits: b.usedUnits,
    heldUnits: b.heldUnits,
    freeUnits: Math.max(0, b.capacityUnits - b.usedUnits - b.heldUnits),
    blocked: b.blocked,
    manual: b.manual,
  };
}
