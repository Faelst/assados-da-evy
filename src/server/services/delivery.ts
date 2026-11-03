import "server-only";
import { db } from "@/server/db";

export function normalizeDistrict(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function quoteDelivery(storeId: string, district: string): Promise<{ feeCents: number } | { error: "NOT_SERVED" }> {
  const zones = await db.deliveryZone.findMany({ where: { storeId } });
  const wanted = normalizeDistrict(district);
  const zone = zones.find((z) => normalizeDistrict(z.district) === wanted);
  return zone ? { feeCents: zone.feeCents } : { error: "NOT_SERVED" };
}
