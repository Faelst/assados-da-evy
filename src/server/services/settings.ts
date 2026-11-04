import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import { validatePlan, type PlanError } from "@/server/domain/production";
import { dateColumn, minutesOf, utcToLocalHHmm, zonedToUtc, type LocalDate } from "@/server/domain/time";
import { regenerateFuture } from "./batches";
import { getDay } from "./calendar";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Substitui o plano de fornadas de um dia da semana, se couber no horário e na capacidade da cozinha. */
export async function saveWeekdayPlan(
  storeId: string,
  weekday: number,
  rows: { productId: string; startTime: string }[],
  now: Date = new Date(),
): Promise<{ ok: true; conflicts: number } | { ok: false; errors: PlanError[] }> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const [hours, products] = await Promise.all([
    db.businessHour.findMany({ where: { storeId, weekday } }),
    db.product.findMany({ where: { storeId, id: { in: rows.map((r) => r.productId) } } }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const invalid: PlanError[] = rows.flatMap((r, index) =>
    byId.has(r.productId) && HHMM.test(r.startTime) ? [] : [{ index, code: "OUTSIDE_HOURS" as const }],
  );
  if (invalid.length) return { ok: false, errors: invalid };
  const result = validatePlan(
    rows.map((r) => ({ productId: r.productId, startTime: r.startTime, durationMin: byId.get(r.productId)!.batchDurationMin })),
    hours,
    store.parallelBatches,
  );
  if (!result.ok) return result;
  await db.$transaction([
    db.weeklyBatchPlan.deleteMany({ where: { storeId, weekday } }),
    db.weeklyBatchPlan.createMany({ data: rows.map((r) => ({ storeId, weekday, productId: r.productId, startTime: r.startTime })) }),
  ]);
  const { conflicts } = await regenerateFuture(storeId, now);
  return { ok: true, conflicts: conflicts.length };
}

export async function saveHours(
  storeId: string,
  rows: { weekday: number; opensAt: string; closesAt: string }[],
  now: Date = new Date(),
): Promise<{ ok: true; conflicts: number } | { ok: false; error: "INVALID_SHIFT" | "OVERLAPPING_SHIFTS" }> {
  for (const r of rows) {
    if (r.weekday < 0 || r.weekday > 6 || !HHMM.test(r.opensAt) || !HHMM.test(r.closesAt) || minutesOf(r.closesAt) <= minutesOf(r.opensAt)) {
      return { ok: false, error: "INVALID_SHIFT" };
    }
  }
  for (let wd = 0; wd < 7; wd++) {
    const day = rows.filter((r) => r.weekday === wd).sort((a, b) => minutesOf(a.opensAt) - minutesOf(b.opensAt));
    for (let i = 1; i < day.length; i++) {
      if (minutesOf(day[i].opensAt) < minutesOf(day[i - 1].closesAt)) return { ok: false, error: "OVERLAPPING_SHIFTS" };
    }
  }
  await db.$transaction([
    db.businessHour.deleteMany({ where: { storeId } }),
    db.businessHour.createMany({ data: rows.map((r) => ({ storeId, ...r })) }),
  ]);
  const { conflicts } = await regenerateFuture(storeId, now);
  return { ok: true, conflicts: conflicts.length };
}

/** Fornada extra numa data específica. */
export async function addManualBatch(
  storeId: string,
  date: LocalDate,
  productId: string,
  startTime: string,
): Promise<{ ok: true } | { ok: false; error: "OVERLAP" | "OUTSIDE_HOURS" | "INVALID" }> {
  if (!HHMM.test(startTime)) return { ok: false, error: "INVALID" };
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const product = await db.product.findFirst({ where: { id: productId, storeId } });
  if (!product) return { ok: false, error: "INVALID" };
  const day = await getDay(storeId, date);
  const existing = await db.productionBatch.findMany({ where: { storeId, date: dateColumn(date) } });
  const planned = [
    ...existing.map((b) => ({
      productId: b.productId,
      startTime: utcToLocalHHmm(b.startsAt, store.timezone),
      durationMin: Math.round((b.readyAt.getTime() - b.startsAt.getTime()) / 60_000),
    })),
    { productId, startTime, durationMin: product.batchDurationMin },
  ];
  const result = validatePlan(planned, day.shifts, store.parallelBatches);
  if (!result.ok) {
    const mine = result.errors.find((e) => e.index === planned.length - 1) ?? result.errors[0];
    return { ok: false, error: mine.code };
  }
  const startsAt = zonedToUtc(date, startTime, store.timezone);
  await db.productionBatch.create({
    data: {
      storeId,
      date: dateColumn(date),
      productId,
      startsAt,
      readyAt: new Date(startsAt.getTime() + product.batchDurationMin * 60_000),
      capacityUnits: product.batchSize,
      manual: true,
    },
  });
  return { ok: true };
}

/** Remove dados pessoais do cliente, mantendo os pedidos para o histórico (LGPD). */
export async function anonymizeCustomer(storeId: string, customerId: string) {
  await db.$transaction([
    db.address.deleteMany({ where: { customerId, customer: { storeId } } }),
    db.order.updateMany({ where: { customerId, storeId }, data: { addressSnapshot: Prisma.DbNull, notes: null } }),
    db.customer.updateMany({
      where: { id: customerId, storeId },
      data: { name: "Cliente removido", phone: `removido-${randomBytes(6).toString("hex")}`, email: null },
    }),
  ]);
}
