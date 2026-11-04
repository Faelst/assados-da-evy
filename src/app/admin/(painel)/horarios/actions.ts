"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { saveHours } from "@/server/services/settings";

export async function saveHoursAction(rows: { weekday: number; opensAt: string; closesAt: string }[]) {
  const s = await requireSection("horarios");
  const r = await saveHours(s.storeId, rows);
  revalidatePath("/", "layout");
  if (r.ok) return { ok: true as const, conflicts: r.conflicts };
  return { ok: false as const, error: r.error === "INVALID_SHIFT" ? "Algum turno fecha antes de abrir." : "Há turnos sobrepostos no mesmo dia." };
}
