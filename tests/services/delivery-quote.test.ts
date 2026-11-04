import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { quoteDistanceDelivery, addressKey } from "@/server/services/delivery";
import type { RoutingProvider } from "@/server/services/routing";
import { createOrder, OrderError, type CheckoutInput } from "@/server/services/orders";
import { upsertDailyMenu } from "@/server/services/stock";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const NOW = new Date("2026-11-03T13:00:00Z"); // 10:00 SP
const address = { cep: "12327-170", street: "Praça dos Três Poderes", number: "100", district: "Centro", city: "Jacareí", state: "SP" };

function fakeProvider(km: number, min: number, calls = { geocode: 0, route: 0 }): RoutingProvider {
  return {
    async geocode() {
      calls.geocode++;
      return { lat: -23.3, lng: -45.9 };
    },
    async route() {
      calls.route++;
      return { distanceKm: km, durationMin: min };
    },
  };
}

describe("cotação de frete por distância", () => {
  let storeId: string;
  let coxinha: string;

  beforeEach(async () => {
    await resetDb();
    storeId = (
      await seedStore({
        deliveryPricing: "DISTANCE", originLat: -23.31, originLng: -45.97,
        deliveryBaseCents: 500, deliveryPerKmCents: 150, deliveryPerMinuteCents: 30, deliveryMinFeeCents: 700,
        deliveryServiceFeeCents: 100, deliveryMaxKm: 15,
      })
    ).id;
    coxinha = (await seedProduct(storeId, { name: "Coxinha", saleModes: ["READY"], priceCents: 800 })).id;
    await seedHours(storeId);
    await upsertDailyMenu(storeId, "2026-11-03", [{ productId: coxinha, qty: 5 }], null);
  });

  it("calcula e guarda a cotação com o detalhamento", async () => {
    const q = await quoteDistanceDelivery(storeId, address, NOW, fakeProvider(4.2, 12));
    expect(q).toMatchObject({ ok: true, feeCents: 1590, breakdown: { distanceKm: 4.2, durationMin: 12 } });
    expect(await db.deliveryQuote.count()).toBe(1);
  });

  it("endereço longe demais não é atendido", async () => {
    expect(await quoteDistanceDelivery(storeId, address, NOW, fakeProvider(20, 30))).toEqual({ ok: false, error: "TOO_FAR" });
  });

  it("sem endereço da cozinha configurado não cota", async () => {
    await db.store.update({ where: { id: storeId }, data: { originLat: null, originLng: null } });
    expect(await quoteDistanceDelivery(storeId, address, NOW, fakeProvider(4, 10))).toEqual({ ok: false, error: "ORIGIN_MISSING" });
  });

  it("endereço não encontrado no mapa", async () => {
    const p: RoutingProvider = { geocode: async () => null, route: async () => ({ distanceKm: 1, durationMin: 1 }) };
    expect(await quoteDistanceDelivery(storeId, address, NOW, p)).toEqual({ ok: false, error: "ADDRESS_NOT_FOUND" });
  });

  it("reaproveita a cotação válida do mesmo endereço sem chamar o mapa de novo", async () => {
    const calls = { geocode: 0, route: 0 };
    await quoteDistanceDelivery(storeId, address, NOW, fakeProvider(4.2, 12, calls));
    await quoteDistanceDelivery(storeId, { ...address, street: "praça dos três poderes " }, NOW, fakeProvider(4.2, 12, calls));
    expect(calls).toEqual({ geocode: 1, route: 1 });
  });

  it("o pedido usa a cotação do servidor e grava distância e tempo", async () => {
    const q = await quoteDistanceDelivery(storeId, address, NOW, fakeProvider(4.2, 12));
    const input: CheckoutInput = {
      type: "READY", sessionId: "s1", items: [{ productId: coxinha, qty: 1 }],
      customer: { name: "Ana", phone: "12999990000" }, fulfillment: "DELIVERY", address,
      paymentMethod: "PIX", privacyAccepted: true, deliveryQuoteId: q.ok ? q.quoteId : undefined,
    };
    const { publicToken } = await createOrder(storeId, input, NOW);
    const o = await db.order.findUniqueOrThrow({ where: { publicToken } });
    expect([o.deliveryFeeCents, o.totalCents, o.deliveryDistanceKm, o.deliveryDurationMin]).toEqual([1590, 2390, 4.2, 12]);
  });

  it("cotação de outro endereço não vale para o pedido", async () => {
    const q = await quoteDistanceDelivery(storeId, address, NOW, fakeProvider(4.2, 12));
    const input: CheckoutInput = {
      type: "READY", sessionId: "s1", items: [{ productId: coxinha, qty: 1 }],
      customer: { name: "Ana", phone: "12999990000" }, fulfillment: "DELIVERY", address: { ...address, number: "999" },
      paymentMethod: "PIX", privacyAccepted: true, deliveryQuoteId: q.ok ? q.quoteId : undefined,
    };
    await expect(createOrder(storeId, input, NOW)).rejects.toEqual(new OrderError("QUOTE_EXPIRED"));
  });

  it("chave do endereço ignora maiúsculas, acentos e espaços", () => {
    expect(addressKey(address)).toBe(addressKey({ ...address, street: " PRACA DOS TRES PODERES", city: "jacarei" }));
  });
});
