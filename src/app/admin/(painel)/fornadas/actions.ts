"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { addManualBatch } from "@/server/services/settings";

export async function updateBatchAction(form: FormData) {
  const s = await requireSection("fornadas");
  const id = String(form.get("id"));
  const batch = await db.productionBatch.findFirst({ where: { id, storeId: s.storeId } });
  if (!batch) return;
  const capacity = Number(form.get("capacity"));
  const blocked = form.get("blocked") === "on";
  const minCapacity = batch.usedUnits + batch.heldUnits;
  await db.productionBatch.update({
    where: { id },
    data: { blocked, ...(Number.isInteger(capacity) && capacity >= minCapacity ? { capacityUnits: capacity } : {}) },
  });
  revalidatePath("/admin/fornadas");
}

export async function removeBatchAction(form: FormData) {
  const s = await requireSection("fornadas");
  const id = String(form.get("id"));
  await db.productionBatch.deleteMany({ where: { id, storeId: s.storeId, manual: true, usedUnits: 0, heldUnits: 0 } });
  revalidatePath("/admin/fornadas");
}

export async function addBatchAction(_: { error?: string } | undefined, form: FormData) {
  const s = await requireSection("fornadas");
  const r = await addManualBatch(s.storeId, String(form.get("date")), String(form.get("productId")), String(form.get("startTime")));
  revalidatePath("/admin/fornadas");
  if (r.ok) return {};
  return {
    error: { OVERLAP: "Sobrepõe outra fornada além do limite da cozinha.", OUTSIDE_HOURS: "Fora do horário da cozinha nesse dia.", INVALID: "Dados inválidos." }[r.error],
  };
}
