"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { geocodeText } from "@/server/services/routing";

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

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));

export async function savePricingAction(_: { error?: string; ok?: string } | undefined, form: FormData) {
  const s = await requireSection("entrega");
  const store = await db.store.findUniqueOrThrow({ where: { id: s.storeId } });
  const mode = form.get("deliveryPricing") === "ZONES" ? "ZONES" : "DISTANCE";
  const originAddress = String(form.get("originAddress") ?? "").trim() || null;
  let originLat = Number.isFinite(num(form.get("originLat"))) && String(form.get("originLat") ?? "").trim() ? num(form.get("originLat")) : null;
  let originLng = Number.isFinite(num(form.get("originLng"))) && String(form.get("originLng") ?? "").trim() ? num(form.get("originLng")) : null;
  let located = "";

  // endereço mudou (ou sem coordenadas): localiza no mapa
  if (originAddress && (originAddress !== store.originAddress || originLat == null || originLng == null)) {
    try {
      const p = await geocodeText(originAddress);
      if (!p) return { error: "Não encontramos o endereço da cozinha no mapa. Escreva rua, número, cidade e estado, ou informe latitude e longitude." };
      originLat = p.lat;
      originLng = p.lng;
      located = " Endereço localizado no mapa.";
    } catch {
      return { error: "O serviço de mapas não respondeu. Tente de novo em alguns segundos." };
    }
  }
  if (mode === "DISTANCE" && (originLat == null || originLng == null)) return { error: "Informe o endereço de saída das entregas." };

  const surgeMultiplier = Math.min(5, Math.max(1, num(form.get("surgeMultiplier")) || 1));
  const surgeStart = String(form.get("surgeStart") ?? "");
  const surgeEnd = String(form.get("surgeEnd") ?? "");
  const hasSurge = HHMM.test(surgeStart) && HHMM.test(surgeEnd) && surgeStart < surgeEnd;
  if (surgeMultiplier > 1 && !hasSurge) return { error: "Para o horário de pico, escolha início e fim (início antes do fim)." };
  const maxKm = num(form.get("deliveryMaxKm"));
  if (!(maxKm > 0 && maxKm <= 200)) return { error: "Raio máximo precisa ficar entre 0,1 e 200 km." };

  await db.store.update({
    where: { id: s.storeId },
    data: {
      deliveryPricing: mode,
      originAddress,
      originLat,
      originLng,
      deliveryBaseCents: cents(form.get("base")),
      deliveryPerKmCents: cents(form.get("perKm")),
      deliveryPerMinuteCents: cents(form.get("perMinute")),
      deliveryMinFeeCents: cents(form.get("minFee")),
      deliveryServiceFeeCents: cents(form.get("serviceFee")),
      deliveryMaxKm: maxKm,
      surgeMultiplier,
      surgeStart: hasSurge ? surgeStart : null,
      surgeEnd: hasSurge ? surgeEnd : null,
    },
  });
  // cotações antigas foram calculadas com outros preços
  await db.deliveryQuote.deleteMany({ where: { storeId: s.storeId } });
  revalidatePath("/admin/entrega");
  revalidatePath("/checkout");
  return { ok: `Frete salvo.${located}` };
}
