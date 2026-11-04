import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { kitchenBoard } from "@/server/services/kitchen";
import { resetDb, seedStore, seedProduct } from "../setup-db";
import type { OrderStatus } from "@/server/domain/order-status";

const NOW = new Date("2026-11-03T15:00:00Z"); // 12:00 em SP, terça 03/11

describe("quadro da cozinha", () => {
  let storeId: string;
  let customerId: string;
  let productId: string;
  let n = 0;

  async function order(o: { type: "READY" | "SCHEDULED"; status: OrderStatus; createdAt: string; scheduledDate?: string; handoffAt?: string }) {
    n++;
    return db.order.create({
      data: {
        storeId, code: `EVY-${n}`, customerId, type: o.type, status: o.status, fulfillment: "PICKUP",
        subtotalCents: 1000, totalCents: 1000, paymentMethod: "PIX", publicToken: `t${n}`, createdAt: new Date(o.createdAt),
        scheduledDate: o.scheduledDate ? new Date(`${o.scheduledDate}T00:00:00Z`) : null,
        handoffAt: o.handoffAt ? new Date(o.handoffAt) : null,
        items: { create: { productId, nameSnapshot: "Coxinha", unitPriceCents: 1000, qty: 2, notes: "sem cebola" } },
      },
    });
  }

  beforeEach(async () => {
    n = 0;
    await resetDb();
    storeId = (await seedStore()).id;
    productId = (await seedProduct(storeId)).id;
    customerId = (await db.customer.create({ data: { storeId, name: "Ana", phone: "11999990000" } })).id;
  });

  it("mostra novos de qualquer data, pronta entrega de hoje e encomendas de hoje", async () => {
    await order({ type: "READY", status: "AWAITING_CONFIRMATION", createdAt: "2026-11-03T14:50:00Z" }); // 1 novo
    await order({ type: "SCHEDULED", status: "AWAITING_CONFIRMATION", createdAt: "2026-11-03T14:00:00Z", scheduledDate: "2026-11-10", handoffAt: "2026-11-10T14:00:00Z" }); // 2 novo futuro
    await order({ type: "READY", status: "PREPARING", createdAt: "2026-11-03T13:00:00Z" }); // 3 hoje
    await order({ type: "SCHEDULED", status: "CONFIRMED", createdAt: "2026-11-01T13:00:00Z", scheduledDate: "2026-11-03", handoffAt: "2026-11-03T18:00:00Z" }); // 4 hoje
    await order({ type: "SCHEDULED", status: "CONFIRMED", createdAt: "2026-11-01T13:00:00Z", scheduledDate: "2026-11-05", handoffAt: "2026-11-05T18:00:00Z" }); // 5 futuro confirmado: fora
    await order({ type: "READY", status: "DELIVERED", createdAt: "2026-11-03T12:00:00Z" }); // 6 finalizado: fora
    await order({ type: "READY", status: "READY", createdAt: "2026-11-02T20:00:00Z" }); // 7 ontem pronto: fora
    const board = await kitchenBoard(storeId, NOW);
    expect(board.columns.NEW.map((o) => o.code)).toEqual(["EVY-2", "EVY-1"]);
    expect(board.columns.TODO.map((o) => o.code)).toEqual(["EVY-4"]);
    expect(board.columns.PREPARING.map((o) => o.code)).toEqual(["EVY-3"]);
    expect(board.columns.READY).toEqual([]);
  });

  it("cartão traz itens, observações, minutos desde a chegada e horário da encomenda", async () => {
    await order({ type: "SCHEDULED", status: "CONFIRMED", createdAt: "2026-11-03T14:30:00Z", scheduledDate: "2026-11-03", handoffAt: "2026-11-03T18:00:00Z" });
    const [card] = (await kitchenBoard(storeId, NOW)).columns.TODO;
    expect(card).toMatchObject({
      code: "EVY-1", customer: "Ana", type: "SCHEDULED", fulfillment: "PICKUP", minutesAgo: 30, handoff: "15:00",
      items: [{ qty: 2, name: "Coxinha", notes: "sem cebola" }],
    });
  });
});
