"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { changeStatus, OrderError, ORDER_ERROR_MESSAGE } from "@/server/services/orders";
import type { OrderStatus } from "@/server/domain/order-status";

const FORWARD: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "PICKED_UP"];

export async function advanceOrderAction(orderId: string, to: OrderStatus): Promise<{ error?: string }> {
  const s = await requireSection("cozinha");
  if (!FORWARD.includes(to)) return { error: "Status inválido." };
  const order = await db.order.findUnique({ where: { id: orderId }, select: { storeId: true } });
  if (!order || order.storeId !== s.storeId) return { error: "Pedido não encontrado." };
  try {
    await changeStatus(orderId, to, { id: s.userId, role: s.role });
  } catch (e) {
    if (e instanceof OrderError) return { error: ORDER_ERROR_MESSAGE[e.code] };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return {};
}
