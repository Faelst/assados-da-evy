import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { ensureBatches, releaseExpiredHolds } from "@/server/services/batches";
import { holdBooking, consumeHolds, availableHandoffs, availableDates, BookingError } from "@/server/services/booking";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const MONDAY = "2026-11-09";
const NOW = new Date("2026-11-03T12:00:00Z");
const READY_11 = new Date("2026-11-09T14:00:00Z");

describe("reservas de encomenda", () => {
  let storeId: string;
  let productId: string;

  beforeEach(async () => {
    await resetDb();
    storeId = (await seedStore()).id;
    productId = (await seedProduct(storeId)).id;
    await seedHours(storeId);
    await db.weeklyBatchPlan.create({ data: { storeId, weekday: 1, productId, startTime: "08:00" } });
    await ensureBatches(storeId, MONDAY, MONDAY);
  });

  it("dois clientes disputando a última vaga: só um consegue", async () => {
    const items = [{ productId, qty: 10 }];
    const results = await Promise.all([
      holdBooking(storeId, "s1", MONDAY, items, READY_11, NOW),
      holdBooking(storeId, "s2", MONDAY, items, READY_11, NOW),
    ]);
    expect(results.filter((r) => "holdIds" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r)).toHaveLength(1);
    const b = await db.productionBatch.findFirstOrThrow();
    expect(b.heldUnits).toBe(10);
  });

  it("nova reserva da mesma sessão substitui a anterior", async () => {
    await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 4 }], READY_11, NOW);
    await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 6 }], READY_11, NOW);
    expect((await db.productionBatch.findFirstOrThrow()).heldUnits).toBe(6);
  });

  it("unidades de produção multiplicam a quantidade", async () => {
    await db.product.update({ where: { id: productId }, data: { productionUnits: 2 } });
    const r = await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 6 }], READY_11, NOW);
    expect(r).toEqual({ error: "UNAVAILABLE" });
  });

  it("consumir reserva vira vaga usada e registra a alocação", async () => {
    await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 4 }], READY_11, NOW);
    const item = await createDummyOrderItem(storeId, productId, 4);
    await db.$transaction((tx) => consumeHolds(tx, "s1", [{ id: item.id, productId, qty: 4 }], NOW));
    const b = await db.productionBatch.findFirstOrThrow();
    expect([b.usedUnits, b.heldUnits]).toEqual([4, 0]);
    expect(await db.orderItemBatch.count()).toBe(1);
    expect(await db.batchHold.count()).toBe(0);
  });

  it("reserva vencida não confirma e as vagas voltam", async () => {
    await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 4 }], READY_11, NOW);
    await db.batchHold.updateMany({ data: { expiresAt: new Date("2026-11-03T11:00:00Z") } });
    const item = await createDummyOrderItem(storeId, productId, 4);
    await expect(db.$transaction((tx) => consumeHolds(tx, "s1", [{ id: item.id, productId, qty: 4 }], NOW))).rejects.toThrow(
      new BookingError("HOLD_EXPIRED"),
    );
    await releaseExpiredHolds(NOW);
    expect((await db.productionBatch.findFirstOrThrow()).heldUnits).toBe(0);
  });

  it("lista os horários de entrega do dia", async () => {
    const list = await availableHandoffs(storeId, MONDAY, [{ productId, qty: 10 }], NOW);
    expect(list).toEqual([{ at: READY_11, label: "11:00", available: true }]);
    const tooMany = await availableHandoffs(storeId, MONDAY, [{ productId, qty: 11 }], NOW);
    expect(tooMany[0].available).toBe(false);
  });

  it("calendário: domingo fechado, segunda disponível, segunda lotada", async () => {
    let dates = await availableDates(storeId, NOW);
    expect(dates.find((d) => d.date === "2026-11-08")?.status).toBe("CLOSED");
    expect(dates.find((d) => d.date === MONDAY)?.status).toBe("AVAILABLE");
    await db.productionBatch.updateMany({ data: { usedUnits: 10 } });
    dates = await availableDates(storeId, NOW);
    expect(dates.find((d) => d.date === MONDAY)?.status).toBe("SOLD_OUT");
  });
});

async function createDummyOrderItem(storeId: string, productId: string, qty: number) {
  const customer = await db.customer.create({ data: { storeId, name: "Ana", phone: "11999990000" } });
  const order = await db.order.create({
    data: {
      storeId, code: "T-1", customerId: customer.id, type: "SCHEDULED", fulfillment: "PICKUP",
      subtotalCents: 0, totalCents: 0, paymentMethod: "PIX", publicToken: crypto.randomUUID(),
    },
  });
  return db.orderItem.create({ data: { orderId: order.id, productId, nameSnapshot: "Panetone", unitPriceCents: 5000, qty } });
}
