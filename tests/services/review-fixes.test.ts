import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { ensureBatches, regenerateFuture, releaseExpiredHolds } from "@/server/services/batches";
import { holdBooking, availableHandoffs } from "@/server/services/booking";
import { createOrder, OrderError } from "@/server/services/orders";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const NOW = new Date("2026-11-03T12:00:00Z");
const MONDAY = "2026-11-09";
const TUESDAY = "2026-11-10";
const READY_MON = new Date("2026-11-09T14:00:00Z");
const READY_TUE = new Date("2026-11-10T14:00:00Z");

describe("correções da revisão", () => {
  let storeId: string;
  let productId: string;

  beforeEach(async () => {
    await resetDb();
    storeId = (await seedStore()).id;
    productId = (await seedProduct(storeId)).id;
    await seedHours(storeId);
    await db.weeklyBatchPlan.createMany({
      data: [
        { storeId, weekday: 1, productId, startTime: "08:00" },
        { storeId, weekday: 2, productId, startTime: "08:00" },
      ],
    });
    await ensureBatches(storeId, MONDAY, TUESDAY);
  });

  it("liberar reservas vencidas em paralelo desconta cada reserva uma vez só", async () => {
    await holdBooking(storeId, "old", MONDAY, [{ productId, qty: 2 }], READY_MON, NOW);
    await holdBooking(storeId, "live", MONDAY, [{ productId, qty: 3 }], READY_MON, NOW);
    await db.batchHold.updateMany({ where: { sessionId: "old" }, data: { expiresAt: new Date("2026-11-03T11:00:00Z") } });
    await Promise.all(Array.from({ length: 6 }, () => releaseExpiredHolds(NOW)));
    const b = await db.productionBatch.findFirstOrThrow({ where: { date: new Date(`${MONDAY}T00:00:00Z`) } });
    expect(b.heldUnits).toBe(3);
  });

  it("pedido com data diferente da reserva é recusado", async () => {
    await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 2 }], READY_MON, NOW);
    await expect(
      createOrder(
        storeId,
        {
          type: "SCHEDULED", sessionId: "s1", items: [{ productId, qty: 2 }], scheduledDate: TUESDAY,
          handoffAt: READY_TUE.toISOString(), customer: { name: "Ana", phone: "11999990000" },
          fulfillment: "PICKUP", paymentMethod: "PIX", privacyAccepted: true,
        },
        NOW,
      ),
    ).rejects.toEqual(new OrderError("HOLD_EXPIRED"));
    expect(await db.order.count()).toBe(0);
  });

  it("reserva fora da janela de agenda ou com quantidade fracionada é recusada", async () => {
    await db.store.update({ where: { id: storeId }, data: { bookingWindowDays: 3 } });
    expect(await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 1 }], READY_MON, NOW)).toEqual({ error: "UNAVAILABLE" });
    await db.store.update({ where: { id: storeId }, data: { bookingWindowDays: 30 } });
    expect(await holdBooking(storeId, "s1", MONDAY, [{ productId, qty: 0.5 }], READY_MON, NOW)).toEqual({ error: "UNAVAILABLE" });
    expect(await availableHandoffs(storeId, "2027-06-01", [{ productId, qty: 1 }], NOW)).toEqual([]);
  });

  it("duas sincronizações simultâneas depois de mudar o plano não quebram", async () => {
    await db.weeklyBatchPlan.deleteMany({ where: { weekday: 1 } });
    await expect(Promise.all(Array.from({ length: 8 }, () => regenerateFuture(storeId, NOW)))).resolves.toBeDefined();
  });
});
