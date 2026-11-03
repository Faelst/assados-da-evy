"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";

const cents = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(String(v ?? "0").replace(",", ".")) * 100) || 0);

export async function saveDeliverySettingsAction(form: FormData) {
  const s = await requireSection("entrega");
  await db.store.update({
    where: { id: s.storeId },
    data: {
      pickupEnabled: form.get("pickupEnabled") === "on",
      deliveryEnabled: form.get("deliveryEnabled") === "on",
      pickupAddress: String(form.get("pickupAddress") ?? "").trim() || null,
      minOrderCents: cents(form.get("minOrder")),
      readyEtaMinutes: Math.max(5, Math.floor(Number(form.get("readyEtaMinutes")) || 60)),
    },
  });
  revalidatePath("/", "layout");
}

export async function addZoneAction(form: FormData) {
  const s = await requireSection("entrega");
  const district = String(form.get("district") ?? "").trim();
  if (!district) return;
  await db.deliveryZone.upsert({
    where: { storeId_district: { storeId: s.storeId, district } },
    create: { storeId: s.storeId, district, feeCents: cents(form.get("fee")) },
    update: { feeCents: cents(form.get("fee")) },
  });
  revalidatePath("/admin/entrega");
}

export async function removeZoneAction(form: FormData) {
  const s = await requireSection("entrega");
  await db.deliveryZone.deleteMany({ where: { id: String(form.get("id")), storeId: s.storeId } });
  revalidatePath("/admin/entrega");
}
