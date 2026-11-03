import { describe, it, expect } from "vitest";
import { canTransition, nextStatuses } from "@/server/domain/order-status";

const pickup = { type: "READY" as const, fulfillment: "PICKUP" as const };
const delivery = { type: "SCHEDULED" as const, fulfillment: "DELIVERY" as const };

describe("transições de status", () => {
  it.each([
    ["AWAITING_CONFIRMATION", "CONFIRMED", "ATTENDANT", pickup, true],
    ["AWAITING_CONFIRMATION", "CANCELLED", "ATTENDANT", pickup, true],
    ["CONFIRMED", "PREPARING", "KITCHEN", pickup, true],
    ["PREPARING", "READY", "KITCHEN", pickup, true],
    ["READY", "PICKED_UP", "ATTENDANT", pickup, true],
    ["READY", "OUT_FOR_DELIVERY", "ATTENDANT", pickup, false],
    ["READY", "OUT_FOR_DELIVERY", "OWNER", delivery, true],
    ["OUT_FOR_DELIVERY", "DELIVERED", "OWNER", delivery, true],
    ["READY", "PICKED_UP", "OWNER", delivery, false],
    ["PREPARING", "CANCELLED", "OWNER", pickup, false],
    ["AWAITING_CONFIRMATION", "CANCELLED", "KITCHEN", pickup, false],
    ["AWAITING_CONFIRMATION", "CONFIRMED", "KITCHEN", pickup, false],
    ["CANCELLED", "CANCELLED", "OWNER", pickup, false],
    ["DELIVERED", "CANCELLED", "OWNER", delivery, false],
  ] as const)("%s → %s por %s", (from, to, role, ctx, expected) => {
    expect(canTransition(from, to, { ...ctx, role })).toBe(expected);
  });

  it("próximos status para atendente num pedido pronto com entrega", () => {
    expect(nextStatuses("READY", { ...delivery, role: "ATTENDANT" })).toEqual(["OUT_FOR_DELIVERY"]);
  });
});
