export type OrderStatus =
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";
export type Role = "OWNER" | "ATTENDANT" | "KITCHEN";
export type TransitionCtx = { type: "READY" | "SCHEDULED"; fulfillment: "PICKUP" | "DELIVERY"; role: Role };

const FLOW: Record<OrderStatus, OrderStatus[]> = {
  AWAITING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["OUT_FOR_DELIVERY", "PICKED_UP"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  PICKED_UP: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionCtx): boolean {
  if (!FLOW[from].includes(to)) return false;
  if (to === "OUT_FOR_DELIVERY" && ctx.fulfillment !== "DELIVERY") return false;
  if (to === "PICKED_UP" && ctx.fulfillment !== "PICKUP") return false;
  if (ctx.role === "KITCHEN") {
    return (from === "CONFIRMED" && to === "PREPARING") || (from === "PREPARING" && to === "READY");
  }
  return true;
}

export function nextStatuses(from: OrderStatus, ctx: TransitionCtx): OrderStatus[] {
  return FLOW[from].filter((to) => canTransition(from, to, ctx));
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  PICKED_UP: "Retirado",
  CANCELLED: "Cancelado",
};

export const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirmar pedido",
  PREPARING: "Iniciar preparo",
  READY: "Marcar como pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Marcar entregue",
  PICKED_UP: "Marcar retirado",
  CANCELLED: "Cancelar",
};
