import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { saveWeekdayPlan, saveHours, addManualBatch, anonymizeCustomer } from "@/server/services/settings";
import { ensureBatches } from "@/server/services/batches";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const NOW = new Date("2026-11-03T13:00:00Z");

describe("configurações da cozinha", () => {
  let storeId: string;
  let panetone: string;
  let hamburgao: string;

  beforeEach(async () => {
    await resetDb();
    storeId = (await seedStore()).id;
    panetone = (await seedProduct(storeId)).id;
    hamburgao = (await seedProduct(storeId, { name: "Hamburgão", batchSize: 15, batchDurationMin: 120 })).id;
    await seedHours(storeId);
  });

  it("salva plano válido e gera as fornadas futuras", async () => {
    const r = await saveWeekdayPlan(storeId, 1, [
      { productId: panetone, startTime: "08:00" },
      { productId: hamburgao, startTime: "11:00" },
    ], NOW);
    expect(r).toMatchObject({ ok: true, conflicts: 0 });
    expect(await db.weeklyBatchPlan.count({ where: { weekday: 1 } })).toBe(2);
    expect(await db.productionBatch.count({ where: { date: new Date("2026-11-09T00:00:00Z") } })).toBe(2);
  });

  it("recusa plano com fornadas sobrepostas quando a cozinha faz uma por vez", async () => {
    const r = await saveWeekdayPlan(storeId, 1, [
      { productId: panetone, startTime: "08:00" },
      { productId: hamburgao, startTime: "10:00" },
    ], NOW);
    expect(r).toEqual({ ok: false, errors: [{ index: 1, code: "OVERLAP" }] });
    expect(await db.weeklyBatchPlan.count()).toBe(0);
  });

  it("aceita sobreposição com duas fornadas simultâneas", async () => {
    await db.store.update({ where: { id: storeId }, data: { parallelBatches: 2 } });
    const r = await saveWeekdayPlan(storeId, 1, [
      { productId: panetone, startTime: "08:00" },
      { productId: hamburgao, startTime: "10:00" },
    ], NOW);
    expect(r.ok).toBe(true);
  });

  it("horário recusa turno que fecha antes de abrir ou turnos sobrepostos", async () => {
    expect(await saveHours(storeId, [{ weekday: 1, opensAt: "18:00", closesAt: "08:00" }], NOW)).toEqual({ ok: false, error: "INVALID_SHIFT" });
    expect(
      await saveHours(storeId, [
        { weekday: 1, opensAt: "08:00", closesAt: "12:00" },
        { weekday: 1, opensAt: "11:00", closesAt: "14:00" },
      ], NOW),
    ).toEqual({ ok: false, error: "OVERLAPPING_SHIFTS" });
    expect(await saveHours(storeId, [{ weekday: 2, opensAt: "09:00", closesAt: "14:00" }], NOW)).toMatchObject({ ok: true });
    expect(await db.businessHour.count()).toBe(1);
  });

  it("fornada avulsa respeita a capacidade da cozinha", async () => {
    await db.weeklyBatchPlan.create({ data: { storeId, weekday: 1, productId: panetone, startTime: "08:00" } });
    await ensureBatches(storeId, "2026-11-09", "2026-11-09");
    expect(await addManualBatch(storeId, "2026-11-09", hamburgao, "09:00")).toEqual({ ok: false, error: "OVERLAP" });
    expect(await addManualBatch(storeId, "2026-11-09", hamburgao, "11:00")).toEqual({ ok: true });
    const manual = await db.productionBatch.findFirstOrThrow({ where: { manual: true } });
    expect(manual.capacityUnits).toBe(15);
  });

  it("anonimiza o cliente a pedido (LGPD)", async () => {
    const c = await db.customer.create({ data: { storeId, name: "Ana", phone: "11999990000", email: "a@x.com" } });
    await db.address.create({ data: { customerId: c.id, cep: "1", street: "R", number: "1", district: "C", city: "X", state: "SP" } });
    await db.order.create({
      data: {
        storeId, code: "T", customerId: c.id, type: "READY", fulfillment: "DELIVERY", subtotalCents: 0, totalCents: 0,
        paymentMethod: "PIX", publicToken: "t", addressSnapshot: { street: "R" },
      },
    });
    await anonymizeCustomer(storeId, c.id);
    const after = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.name).toBe("Cliente removido");
    expect(after.phone).not.toBe("11999990000");
    expect(after.email).toBeNull();
    expect(await db.address.count()).toBe(0);
    expect((await db.order.findFirstOrThrow()).addressSnapshot).toBeNull();
  });
});
