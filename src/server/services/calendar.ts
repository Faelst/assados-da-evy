import "server-only";
import { db } from "@/server/db";
import { isOpenAt, resolveDay, type ResolvedDay } from "@/server/domain/production";
import { dateColumn, todayIn, utcToLocalHHmm, weekdayOf, type LocalDate } from "@/server/domain/time";

/** Horário e plano resolvidos de uma data (semana + exceção). */
export async function getDay(storeId: string, date: LocalDate): Promise<ResolvedDay> {
  const [hours, plan, exception] = await Promise.all([
    db.businessHour.findMany({ where: { storeId } }),
    db.weeklyBatchPlan.findMany({ where: { storeId } }),
    db.calendarException.findUnique({ where: { storeId_date: { storeId, date: dateColumn(date) } }, include: { plan: true } }),
  ]);
  return resolveDay({ weekday: weekdayOf(date), hours, plan, exception });
}

export type StoreStatus = { open: boolean; today: LocalDate; shifts: { opensAt: string; closesAt: string }[]; now: string };

export async function getStoreStatus(storeId: string, now: Date = new Date()): Promise<StoreStatus> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const today = todayIn(store.timezone, now);
  const day = await getDay(storeId, today);
  const hhmm = utcToLocalHHmm(now, store.timezone);
  return { open: !day.closed && isOpenAt(day.shifts, hhmm), today, shifts: day.shifts, now: hhmm };
}
