import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { ensureBatches } from "@/server/services/batches";
import { holdBooking } from "@/server/services/booking";
import { createOrder, changeStatus } from "@/server/services/orders";
import { weekAgenda, productionDay, weekStartOf } from "@/server/services/agenda";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const NOW = new Date("2026-11-03T13:00:00Z");
const MONDAY = "2026-11-09";
const READY_11 = new Date("2026-11-09T14:00:00Z");

describe("agenda semanal", () => {
  let storeId: string;
  let panetone: string;

  beforeEach(async () => {
    await resetDb();
    storeId = (await seedStore()).id;
    panetone = (await seedProduct(storeId)).id;
    await seedHours(storeId);
    await db.weeklyBatchPlan.createMany({
      data: [
        { storeId, weekday: 1, productId: panetone, startTime: "08:00" },
        { storeId, weekday: 1, productId: panetone, startTime: "11:00" },
      ],
    });
    await ensureBatches(storeId, MONDAY, MONDAY);
    await holdBooking(storeId, "s1", MONDAY, [{ productId: panetone, qty: 3 }], READY_11, NOW);
    await createOrder(
      storeId,
      {
        type: "SCHEDULED", sessionId: "s1", items: [{ productId: panetone, qty: 3 }], scheduledDate: MONDAY,
        handoffAt: READY_11.toISOString(), customer: { name: "Ana", phone: "11999990000" },
        fulfillment: "PICKUP", paymentMethod: "PIX", privacyAccepted: true,
      },
      NOW,
    );
  });

  it("semana começa na segunda", () => {
    expect(weekStartOf("2026-11-12")).toBe("2026-11-09");
    expect(weekStartOf("2026-11-15")).toBe("2026-11-09");
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09");
  });

  it("mostra as fornadas com os pedidos dentro, em horário local", async () => {
    const days = await weekAgenda(storeId, MONDAY);
    expect(days).toHaveLength(7);
    const monday = days[0];
    expect(monday.date).toBe(MONDAY);
    expect(monday.batches.map((b) => [b.start, b.end, b.usedUnits, b.capacityUnits])).toEqual([
      ["08:00", "11:00", 3, 10],
      ["11:00", "14:00", 0, 10],
    ]);
    expect(monday.batches[0].orders).toMatchObject([{ code: "EVY-0001", customer: "Ana", units: 3, status: "AWAITING_CONFIRMATION" }]);
  });

  it("pedido cancelado sai da agenda", async () => {
    const order = await db.order.findFirstOrThrow();
    const owner = await db.user.create({ data: { storeId, name: "E", email: "e@x.com", passwordHash: "x", role: "OWNER" } });
    await changeStatus(order.id, "CANCELLED", { id: owner.id, role: "OWNER" }, "x");
    const days = await weekAgenda(storeId, MONDAY);
    expect(days[0].batches[0].orders).toEqual([]);
  });

  it("produção do dia consolida por receita", async () => {
    const p = await productionDay(storeId, MONDAY);
    expect(p).toEqual([
      { productId: panetone, productName: "Panetone", totalUnits: 3, batches: [{ start: "08:00", ready: "11:00", units: 3 }] },
    ]);
  });
});
