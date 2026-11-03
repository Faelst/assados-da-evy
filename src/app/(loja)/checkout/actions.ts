"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/server/store";
import { holdBooking } from "@/server/services/booking";
import { createOrder, OrderError, ORDER_ERROR_MESSAGE, type CheckoutInput } from "@/server/services/orders";

export async function holdAction(input: {
  sessionId: string;
  date: string;
  items: { productId: string; qty: number }[];
  handoffAt: string;
}): Promise<{ expiresAt: string } | { error: string }> {
  const store = await getStore();
  const at = new Date(input.handoffAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(at.getTime()) || !input.sessionId) {
    return { error: "Dados inválidos." };
  }
  const r = await holdBooking(store.id, input.sessionId, input.date, input.items, at);
  if ("error" in r) return { error: "Esse horário acabou de lotar. Escolha outro." };
  return { expiresAt: r.expiresAt.toISOString() };
}

export async function placeOrderAction(input: CheckoutInput): Promise<{ error: string; code: string } | undefined> {
  const store = await getStore();
  let token: string;
  try {
    token = (await createOrder(store.id, input)).publicToken;
  } catch (e) {
    if (e instanceof OrderError) return { error: ORDER_ERROR_MESSAGE[e.code], code: e.code };
    console.error(e);
    return { error: "Não conseguimos registrar o pedido. Tente de novo.", code: "UNKNOWN" };
  }
  redirect(`/pedido/${token}?novo=1`);
}
