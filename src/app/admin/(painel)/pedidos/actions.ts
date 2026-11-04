"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { changeStatus, OrderError, ORDER_ERROR_MESSAGE } from "@/server/services/orders";
import type { OrderStatus } from "@/server/domain/order-status";

const STATUSES: OrderStatus[] = [
  "AWAITING_CONFIRMATION", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "PICKED_UP", "CANCELLED",
];

export async function changeStatusAction(_: { error?: string } | undefined, form: FormData) {
  const s = await requireSection("pedidos");
  const orderId = String(form.get("orderId") ?? "");
  const to = String(form.get("to") ?? "") as OrderStatus;
  const reason = String(form.get("reason") ?? "").trim() || undefined;
  if (!STATUSES.includes(to)) return { error: "Status inválido." };
  if (to === "CANCELLED" && !reason) return { error: "Informe o motivo do cancelamento." };
  const order = await db.order.findUnique({ where: { id: orderId }, select: { storeId: true } });
  if (!order || order.storeId !== s.storeId) return { error: "Pedido não encontrado." };
  try {
    await changeStatus(orderId, to, { id: s.userId, role: s.role }, reason);
  } catch (e) {
    if (e instanceof OrderError) return { error: ORDER_ERROR_MESSAGE[e.code] };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return {};
}

export async function markPaidAction(form: FormData) {
  const s = await requireSection("pedidos");
  if (s.role === "KITCHEN") return;
  const orderId = String(form.get("orderId") ?? "");
  await db.order.updateMany({ where: { id: orderId, storeId: s.storeId }, data: { paymentStatus: "PAID" } });
  revalidatePath(`/admin/pedidos/${orderId}`);
}
