import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { upsertDailyMenu, adjustStock, decrementForSale, getTodayMenu, StockError } from "@/server/services/stock";
import { resetDb, seedStore, seedProduct, seedHours } from "../setup-db";

const TODAY = "2026-11-03"; // terça
const NOW = new Date("2026-11-03T13:00:00Z"); // 10:00 em SP

describe("pronta entrega", () => {
  let storeId: string;
  let productId: string;
  let itemId: string;

  beforeEach(async () => {
    await resetDb();
    storeId = (await seedStore()).id;
    productId = (await seedProduct(storeId, { name: "Coxinha", saleModes: ["READY"], priceCents: 800 })).id;
    await seedHours(storeId);
    await upsertDailyMenu(storeId, TODAY, [{ productId, qty: 1 }], null);
    itemId = (await db.dailyMenuItem.findFirstOrThrow()).id;
  });

  it("mostra o cardápio do dia com a loja aberta", async () => {
    const menu = await getTodayMenu(storeId, NOW);
    expect(menu?.open).toBe(true);
    expect(menu?.items.map((i) => [i.name, i.qtyAvailable])).toEqual([["Coxinha", 1]]);
  });

  it("loja fechada às 20h", async () => {
    const menu = await getTodayMenu(storeId, new Date("2026-11-03T23:00:00Z"));
    expect(menu?.open).toBe(false);
  });

  it("duas vendas simultâneas da última unidade: só uma passa", async () => {
    const sell = () => db.$transaction((tx) => decrementForSale(tx, itemId, 1, null));
    const results = await Promise.allSettled([sell(), sell()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toEqual(new StockError("OUT_OF_STOCK"));
    expect((await db.dailyMenuItem.findUniqueOrThrow({ where: { id: itemId } })).qtyAvailable).toBe(0);
  });

  it("saída maior que o estoque é recusada", async () => {
    await expect(adjustStock(itemId, -5, "LOSS", "caiu no chão", null)).rejects.toEqual(new StockError("OUT_OF_STOCK"));
  });

  it("toda operação gera movimentação", async () => {
    await adjustStock(itemId, 5, "IN", "nova fornada", null);
    await db.$transaction((tx) => decrementForSale(tx, itemId, 2, null));
    const types = (await db.stockMovement.findMany({ orderBy: { createdAt: "asc" } })).map((m) => [m.type, m.qty]);
    expect(types).toEqual([["IN", 1], ["IN", 5], ["SALE", 2]]);
  });

  it("refazer o cardápio do dia ajusta a quantidade sem duplicar item", async () => {
    await upsertDailyMenu(storeId, TODAY, [{ productId, qty: 4 }], null);
    const items = await db.dailyMenuItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0].qtyAvailable).toBe(4);
  });
});
