"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { regenerateFuture } from "@/server/services/batches";
import { resolveDay, validatePlan } from "@/server/domain/production";
import { dateColumn, weekdayOf } from "@/server/domain/time";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function createExceptionAction(_: { error?: string; ok?: string } | undefined, form: FormData) {
  const s = await requireSection("excecoes");
  const date = String(form.get("date") ?? "");
  const type = String(form.get("type") ?? "") as "CLOSED" | "SPECIAL_HOURS" | "SPECIAL_MENU";
  const opensAt = String(form.get("opensAt") ?? "") || null;
  const closesAt = String(form.get("closesAt") ?? "") || null;
  const note = String(form.get("note") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["CLOSED", "SPECIAL_HOURS", "SPECIAL_MENU"].includes(type)) return { error: "Preencha a data e o tipo." };
  if (type === "SPECIAL_HOURS" && (!opensAt || !closesAt || !HHMM.test(opensAt) || !HHMM.test(closesAt) || opensAt >= closesAt)) {
    return { error: "Informe o horário especial (abre antes de fechar)." };
  }
  const productIds = form.getAll("planProduct").map(String);
  const starts = form.getAll("planStart").map(String);
  const plan = productIds.map((productId, i) => ({ productId, startTime: starts[i] })).filter((p) => p.productId && HHMM.test(p.startTime));
  if (type === "SPECIAL_MENU") {
    if (plan.length === 0) return { error: "Adicione ao menos uma fornada ao cardápio especial." };
    const [hours, products, store] = await Promise.all([
      db.businessHour.findMany({ where: { storeId: s.storeId } }),
      db.product.findMany({ where: { storeId: s.storeId, id: { in: plan.map((p) => p.productId) } } }),
      db.store.findUniqueOrThrow({ where: { id: s.storeId } }),
    ]);
    const day = resolveDay({ weekday: weekdayOf(date), hours, plan: [], exception: { type, opensAt, closesAt, plan } });
    const dur = new Map(products.map((p) => [p.id, p.batchDurationMin]));
    const check = validatePlan(plan.map((p) => ({ ...p, durationMin: dur.get(p.productId) ?? 0 })), day.shifts, store.parallelBatches);
    if (!check.ok) return { error: "As fornadas do cardápio especial se sobrepõem ou ficam fora do horário." };
  }
  await db.calendarException.deleteMany({ where: { storeId: s.storeId, date: dateColumn(date) } });
  await db.calendarException.create({
    data: {
      storeId: s.storeId,
      date: dateColumn(date),
      type,
      opensAt: type === "CLOSED" ? null : opensAt,
      closesAt: type === "CLOSED" ? null : closesAt,
      note,
      plan: type === "SPECIAL_MENU" ? { create: plan } : undefined,
    },
  });
  const { conflicts } = await regenerateFuture(s.storeId);
  revalidatePath("/", "layout");
  return { ok: conflicts.length ? `Exceção salva. ${conflicts.length} fornada(s) já vendida(s) foram mantidas; avise os clientes.` : "Exceção salva." };
}

export async function deleteExceptionAction(form: FormData) {
  const s = await requireSection("excecoes");
  await db.calendarException.deleteMany({ where: { id: String(form.get("id")), storeId: s.storeId } });
  await regenerateFuture(s.storeId);
  revalidatePath("/", "layout");
}
