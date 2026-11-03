"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { saveWeekdayPlan } from "@/server/services/settings";

export async function savePlanAction(weekday: number, rows: { productId: string; startTime: string }[]) {
  const s = await requireSection("plano-de-fornadas");
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false as const, errors: [] };
  const r = await saveWeekdayPlan(s.storeId, weekday, rows);
  revalidatePath("/admin", "layout");
  revalidatePath("/encomendar");
  return r;
}
