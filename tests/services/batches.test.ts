import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { ensureBatches, regenerateFuture, listDayBatches } from "@/server/services/batches";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const MONDAY = "2026-11-09";
const NOW = new Date("2026-11-03T12:00:00Z");

describe("fornadas por data", () => {
  let storeId: string;
  let productId: string;

  beforeEach(async () => {
    await resetDb();
    storeId = (await seedStore()).id;
    productId = (await seedProduct(storeId)).id;
    await seedHours(storeId);
    await db.weeklyBatchPlan.create({ data: { storeId, weekday: 1, productId, startTime: "08:00" } });
  });

  it("cria a fornada do plano com horário de pronto em SP", async () => {
    await ensureBatches(storeId, MONDAY, MONDAY);
    const batches = await db.productionBatch.findMany();
    expect(batches).toHaveLength(1);
    expect(batches[0].startsAt.toISOString()).toBe("2026-11-09T11:00:00.000Z");
    expect(batches[0].readyAt.toISOString()).toBe("2026-11-09T14:00:00.000Z");
    expect(batches[0].capacityUnits).toBe(10);
  });

  it("é idempotente", async () => {
    await ensureBatches(storeId, MONDAY, MONDAY);
    await ensureBatches(storeId, MONDAY, MONDAY);
    expect(await db.productionBatch.count()).toBe(1);
  });

  it("fornada vazia some quando sai do plano", async () => {
    await ensureBatches(storeId, MONDAY, MONDAY);
    await db.weeklyBatchPlan.deleteMany();
    const { conflicts } = await regenerateFuture(storeId, NOW);
    expect(conflicts).toHaveLength(0);
    expect(await db.productionBatch.count()).toBe(0);
  });

  it("fornada já vendida permanece e vira conflito", async () => {
    await ensureBatches(storeId, MONDAY, MONDAY);
    await db.productionBatch.updateMany({ data: { usedUnits: 3 } });
    await db.weeklyBatchPlan.deleteMany();
    const { conflicts } = await regenerateFuture(storeId, NOW);
    expect(conflicts).toHaveLength(1);
    expect(await db.productionBatch.count()).toBe(1);
  });

  it("fornada manual não é apagada", async () => {
    await ensureBatches(storeId, MONDAY, MONDAY);
    await db.productionBatch.updateMany({ data: { manual: true } });
    await db.weeklyBatchPlan.deleteMany();
    await regenerateFuture(storeId, NOW);
    expect(await db.productionBatch.count()).toBe(1);
  });

  it("dia fechado por exceção não tem fornada", async () => {
    await db.calendarException.create({ data: { storeId, date: new Date(`${MONDAY}T00:00:00Z`), type: "CLOSED" } });
    await ensureBatches(storeId, MONDAY, MONDAY);
    expect(await db.productionBatch.count()).toBe(0);
  });

  it("lista o dia com vagas livres descontando reservas válidas", async () => {
    await ensureBatches(storeId, MONDAY, MONDAY);
    const b = await db.productionBatch.findFirstOrThrow();
    await db.productionBatch.update({ where: { id: b.id }, data: { usedUnits: 2, heldUnits: 3 } });
    const list = await listDayBatches(storeId, MONDAY);
    expect(list).toHaveLength(1);
    expect(list[0].freeUnits).toBe(5);
    expect(list[0].productName).toBe("Panetone");
  });
});
