"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/server/store";
import { holdBooking } from "@/server/services/booking";
import { quoteDistanceDelivery } from "@/server/services/delivery";
import type { FeeBreakdown } from "@/server/domain/delivery-pricing";
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

const QUOTE_ERRORS = {
  ORIGIN_MISSING: "A loja ainda não configurou o endereço de saída das entregas. Escolha retirada ou fale pelo WhatsApp.",
  ADDRESS_NOT_FOUND: "Não encontramos esse endereço no mapa. Confira rua, número e cidade.",
  ROUTE_FAILED: "Não conseguimos calcular a rota agora. Tente de novo em alguns segundos.",
  TOO_FAR: "Esse endereço fica fora da nossa área de entrega.",
} as const;

export async function quoteDeliveryAction(address: {
  cep: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
}): Promise<{ quoteId: string; feeCents: number; breakdown: FeeBreakdown } | { error: string }> {
  const fields = [address.cep, address.street, address.number, address.city, address.state];
  if (fields.some((f) => typeof f !== "string" || !f.trim() || f.length > 200)) return { error: "Preencha o endereço completo." };
  const store = await getStore();
  const r = await quoteDistanceDelivery(store.id, address);
  if (!r.ok) return { error: QUOTE_ERRORS[r.error] };
  return { quoteId: r.quoteId, feeCents: r.feeCents, breakdown: r.breakdown };
}
