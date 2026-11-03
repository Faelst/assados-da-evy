import { STATUS_LABEL, type OrderStatus } from "@/server/domain/order-status";

const COLORS: Record<OrderStatus, string> = {
  AWAITING_CONFIRMATION: "bg-amber/30 text-terracotta-dark",
  CONFIRMED: "bg-sky-100 text-sky-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY: "bg-emerald-100 text-emerald-800",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-ink/10 text-ink/70",
  PICKED_UP: "bg-ink/10 text-ink/70",
  CANCELLED: "bg-tomato/15 text-tomato",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`chip ${COLORS[status]}`}>{STATUS_LABEL[status]}</span>;
}
