import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { quoteFee, type FeeBreakdown } from "@/server/domain/delivery-pricing";
import { utcToLocalHHmm } from "@/server/domain/time";
import { osmProvider, type GeoAddress, type RoutingProvider } from "./routing";

export function normalizeDistrict(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function quoteDelivery(storeId: string, district: string): Promise<{ feeCents: number } | { error: "NOT_SERVED" }> {
  const zones = await db.deliveryZone.findMany({ where: { storeId } });
  const wanted = normalizeDistrict(district);
  const zone = zones.find((z) => normalizeDistrict(z.district) === wanted);
  return zone ? { feeCents: zone.feeCents } : { error: "NOT_SERVED" };
}

const QUOTE_MINUTES = 30;

export function addressKey(a: GeoAddress) {
  return [a.cep.replace(/\D/g, ""), a.street, a.number, a.city, a.state].map(normalizeDistrict).join("|");
}

export type DistanceQuote =
  | { ok: true; quoteId: string; feeCents: number; breakdown: FeeBreakdown }
  | { ok: false; error: "ORIGIN_MISSING" | "ADDRESS_NOT_FOUND" | "ROUTE_FAILED" | "TOO_FAR" };

/** Cota o frete estilo app de corrida (distância e tempo de rota) e guarda a cotação por 30 min. */
export async function quoteDistanceDelivery(
  storeId: string,
  address: GeoAddress,
  now: Date = new Date(),
  provider: RoutingProvider = osmProvider,
): Promise<DistanceQuote> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  if (store.originLat == null || store.originLng == null) return { ok: false, error: "ORIGIN_MISSING" };
  const key = addressKey(address);

  const cached = await db.deliveryQuote.findFirst({
    where: { storeId, addressKey: key, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (cached) return { ok: true, quoteId: cached.id, feeCents: cached.feeCents, breakdown: cached.breakdown as FeeBreakdown };

  let to;
  let trip;
  try {
    to = await provider.geocode(address);
    if (!to) return { ok: false, error: "ADDRESS_NOT_FOUND" };
    trip = await provider.route({ lat: store.originLat, lng: store.originLng }, to);
  } catch (e) {
    console.error("[frete] serviço de mapas falhou", e);
    return { ok: false, error: "ROUTE_FAILED" };
  }
  if (!trip) return { ok: false, error: "ROUTE_FAILED" };

  const fee = quoteFee(
    trip,
    {
      baseCents: store.deliveryBaseCents,
      perKmCents: store.deliveryPerKmCents,
      perMinuteCents: store.deliveryPerMinuteCents,
      minFeeCents: store.deliveryMinFeeCents,
      serviceFeeCents: store.deliveryServiceFeeCents,
      maxKm: store.deliveryMaxKm,
      surgeMultiplier: store.surgeMultiplier,
      surgeStart: store.surgeStart,
      surgeEnd: store.surgeEnd,
    },
    utcToLocalHHmm(now, store.timezone),
  );
  if (!fee.ok) return { ok: false, error: "TOO_FAR" };

  const quote = await db.deliveryQuote.create({
    data: {
      storeId,
      addressKey: key,
      lat: to.lat,
      lng: to.lng,
      distanceKm: trip.distanceKm,
      durationMin: trip.durationMin,
      feeCents: fee.breakdown.totalCents,
      breakdown: fee.breakdown as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(now.getTime() + QUOTE_MINUTES * 60_000),
    },
  });
  return { ok: true, quoteId: quote.id, feeCents: quote.feeCents, breakdown: fee.breakdown };
}

/** Cotação válida do servidor para o endereço do pedido (nunca confia no valor enviado pelo cliente). */
export async function findValidQuote(storeId: string, quoteId: string | undefined, address: GeoAddress, now: Date) {
  if (!quoteId) return null;
  const q = await db.deliveryQuote.findFirst({ where: { id: quoteId, storeId, expiresAt: { gt: now } } });
  if (!q || q.addressKey !== addressKey(address)) return null;
  return q;
}
