import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { createOrder, changeStatus, getOrderByToken, OrderError, type CheckoutInput } from "@/server/services/orders";
import { upsertDailyMenu } from "@/server/services/stock";
import { ensureBatches } from "@/server/services/batches";
import { holdBooking } from "@/server/services/booking";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const TODAY = "2026-11-03";
const NOW = new Date("2026-11-03T13:00:00Z"); // terça 10:00 SP
const MONDAY = "2026-11-09";
const READY_11 = new Date("2026-11-09T14:00:00Z");

function readyInput(productId: string, over: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    type: "READY",
    sessionId: "s1",
    items: [{ productId, qty: 2 }],
    customer: { name: "Ana", phone: "(11) 99999-0000" },
    fulfillment: "PICKUP",
    paymentMethod: "PIX",
    privacyAccepted: true,
    ...over,
  };
}

describe("pedidos", () => {
  let storeId: string;
  let coxinha: string;
  let owner: { id: string; role: "OWNER" };

  beforeEach(async () => {
    await resetDb();
    storeId = (await seedStore({ deliveryPricing: "ZONES" })).id;
    coxinha = (await seedProduct(storeId, { name: "Coxinha", saleModes: ["READY"], priceCents: 800 })).id;
    await seedHours(storeId);
    await upsertDailyMenu(storeId, TODAY, [{ productId: coxinha, qty: 5 }], null);
    await db.deliveryZone.create({ data: { storeId, district: "Centro", feeCents: 700 } });
    const u = await db.user.create({ data: { storeId, name: "Evy", email: "evy@x.com", passwordHash: "x", role: "OWNER" } });
    owner = { id: u.id, role: "OWNER" };
  });

  it("pronta entrega baixa estoque, calcula total e grava histórico", async () => {
    const { code, publicToken } = await createOrder(storeId, readyInput(coxinha), NOW);
    expect(code).toBe("EVY-0001");
    const order = await getOrderByToken(publicToken);
    expect(order?.totalCents).toBe(1600);
    expect(order?.status).toBe("AWAITING_CONFIRMATION");
    expect(order?.history).toHaveLength(1);
    expect((await db.dailyMenuItem.findFirstOrThrow()).qtyAvailable).toBe(3);
  });

  it("ignora preço enviado pelo cliente", async () => {
    const input = readyInput(coxinha, { items: [{ productId: coxinha, qty: 1, unitPriceCents: 1 } as never] });
    const { publicToken } = await createOrder(storeId, input, NOW);
    expect((await getOrderByToken(publicToken))?.subtotalCents).toBe(800);
  });

  it("entrega soma a taxa do bairro", async () => {
    const { publicToken } = await createOrder(
      storeId,
      readyInput(coxinha, {
        fulfillment: "DELIVERY",
        address: { cep: "01001-000", street: "Rua A", number: "10", district: "centro", city: "São Paulo", state: "SP" },
      }),
      NOW,
    );
    expect((await getOrderByToken(publicToken))?.totalCents).toBe(2300);
  });

  it("bairro fora da área é recusado", async () => {
    const input = readyInput(coxinha, {
      fulfillment: "DELIVERY",
      address: { cep: "01001-000", street: "Rua A", number: "10", district: "Longe", city: "São Paulo", state: "SP" },
    });
    await expect(createOrder(storeId, input, NOW)).rejects.toEqual(new OrderError("NOT_SERVED"));
  });

  it("pedido mínimo", async () => {
    await db.store.update({ where: { id: storeId }, data: { minOrderCents: 5000 } });
    await expect(createOrder(storeId, readyInput(coxinha), NOW)).rejects.toEqual(new OrderError("MIN_ORDER"));
  });

  it("loja fechada não aceita pronta entrega", async () => {
    await expect(createOrder(storeId, readyInput(coxinha), new Date("2026-11-03T23:30:00Z"))).rejects.toEqual(
      new OrderError("STORE_CLOSED"),
    );
  });

  it("cancelar devolve o estoque uma vez só", async () => {
    const { publicToken } = await createOrder(storeId, readyInput(coxinha), NOW);
    const order = (await getOrderByToken(publicToken))!;
    await changeStatus(order.id, "CANCELLED", owner, "cliente desistiu");
    await expect(changeStatus(order.id, "CANCELLED", owner, "de novo")).rejects.toEqual(new OrderError("INVALID_TRANSITION"));
    expect((await db.dailyMenuItem.findFirstOrThrow()).qtyAvailable).toBe(5);
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.cancelReason).toBe("cliente desistiu");
  });

  it("encomenda consome a reserva e o cancelamento devolve a vaga", async () => {
    const panetone = (await seedProduct(storeId)).id;
    await db.weeklyBatchPlan.create({ data: { storeId, weekday: 1, productId: panetone, startTime: "08:00" } });
    await ensureBatches(storeId, MONDAY, MONDAY);
    await holdBooking(storeId, "s9", MONDAY, [{ productId: panetone, qty: 4 }], READY_11, NOW);
    const { publicToken } = await createOrder(
      storeId,
      { ...readyInput(panetone), type: "SCHEDULED", sessionId: "s9", items: [{ productId: panetone, qty: 4 }], scheduledDate: MONDAY, handoffAt: READY_11.toISOString() },
      NOW,
    );
    let batch = await db.productionBatch.findFirstOrThrow();
    expect([batch.usedUnits, batch.heldUnits]).toEqual([4, 0]);
    const order = (await getOrderByToken(publicToken))!;
    expect(order.handoffAt?.toISOString()).toBe(READY_11.toISOString());
    await changeStatus(order.id, "CANCELLED", owner, "x");
    batch = await db.productionBatch.findFirstOrThrow();
    expect(batch.usedUnits).toBe(0);
  });

  it("encomenda sem reserva válida falha", async () => {
    const panetone = (await seedProduct(storeId)).id;
    await expect(
      createOrder(
        storeId,
        { ...readyInput(panetone), type: "SCHEDULED", sessionId: "nada", items: [{ productId: panetone, qty: 1 }], scheduledDate: MONDAY, handoffAt: READY_11.toISOString() },
        NOW,
      ),
    ).rejects.toEqual(new OrderError("HOLD_EXPIRED"));
    expect(await db.order.count()).toBe(0);
  });

  it("cozinha não pode confirmar pedido", async () => {
    const { publicToken } = await createOrder(storeId, readyInput(coxinha), NOW);
    const order = (await getOrderByToken(publicToken))!;
    await expect(changeStatus(order.id, "CONFIRMED", { id: owner.id, role: "KITCHEN" })).rejects.toEqual(
      new OrderError("INVALID_TRANSITION"),
    );
  });
});
