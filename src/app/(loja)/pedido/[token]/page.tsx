import { notFound } from "next/navigation";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { connection } from "next/server";
import { getOrderByToken } from "@/server/services/orders";
import { STATUS_LABEL, type OrderStatus } from "@/server/domain/order-status";
import { utcToLocalHHmm } from "@/server/domain/time";
import { formatCents } from "@/lib/phone";
import { waLink } from "@/lib/data";
import { WhatsAppIcon } from "@/components/icons";
import { OrderPageEffects } from "@/components/loja/OrderPageEffects";
import { DeliveryBreakdown } from "@/components/loja/DeliveryBreakdown";
import type { FeeBreakdown } from "@/server/domain/delivery-pricing";

export const metadata = { title: "Seu pedido — Assados da Evy", robots: { index: false } };

const PAYMENT = { PIX: "Pix", CASH: "Dinheiro", CARD: "Cartão" } as const;

function steps(fulfillment: "PICKUP" | "DELIVERY"): OrderStatus[] {
  return fulfillment === "DELIVERY"
    ? ["AWAITING_CONFIRMATION", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]
    : ["AWAITING_CONFIRMATION", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"];
}

export default async function PedidoPage({ params, searchParams }: PageProps<"/pedido/[token]">) {
  await connection();
  const { token } = await params;
  const { novo } = await searchParams;
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const tz = order.store.timezone;
  const cancelled = order.status === "CANCELLED";
  const flow = steps(order.fulfillment);
  const reached = new Map(order.history.map((h) => [h.toStatus, h.createdAt]));
  const currentIndex = flow.indexOf(order.status);
  const final = order.status === "DELIVERED" || order.status === "PICKED_UP" || cancelled;
  const address = order.addressSnapshot as Record<string, string> | null;
  const fmtDateTime = (d: Date) =>
    d.toLocaleString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <OrderPageEffects isNew={novo === "1"} live={!final} />
      {novo === "1" && (
        <div className="rounded-3xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-200">
          <p className="font-display text-2xl font-bold">Pedido recebido! 🎉</p>
          <p className="text-sm">Guarde este link para acompanhar. A Evy vai confirmar o seu pedido em breve.</p>
        </div>
      )}

      <div className="card space-y-1">
        <p className="text-sm text-ink/60">Pedido</p>
        <h1 className="font-display text-3xl font-bold text-terracotta-dark">{order.code}</h1>
        <p className="font-semibold">
          {order.type === "SCHEDULED" && order.handoffAt
            ? `Encomenda · ${fmtDateTime(order.handoffAt)}`
            : `Pronta entrega · ${fmtDateTime(order.createdAt)}`}
          {" · "}
          {order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
        </p>
      </div>

      <section className="card">
        <h2 className="mb-3 font-display text-xl font-bold">Acompanhamento</h2>
        {cancelled ? (
          <p className="flex items-center gap-2 font-semibold text-tomato">
            <XCircle className="size-5" /> Pedido cancelado{order.cancelReason ? `: ${order.cancelReason}` : ""}
          </p>
        ) : (
          <ol className="space-y-3">
            {flow.map((s, i) => {
              const done = i <= currentIndex;
              const at = reached.get(s);
              return (
                <li key={s} className={`flex items-center gap-3 ${done ? "text-ink" : "text-ink/40"}`}>
                  {done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5" />}
                  <span className={i === currentIndex ? "font-bold" : ""}>{STATUS_LABEL[s]}</span>
                  {at && <span className="ml-auto text-xs text-ink/50">{utcToLocalHHmm(at, tz)}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-xl font-bold">Itens</h2>
        <ul className="space-y-1 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span>{i.qty}× {i.nameSnapshot}</span>
              <span className="tabular-nums">{formatCents(i.qty * i.unitPriceCents)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-terracotta/10 pt-2 text-sm">
          {order.deliveryFeeCents > 0 && (
            <div className="flex justify-between"><span>Entrega</span><span>{formatCents(order.deliveryFeeCents)}</span></div>
          )}
          {order.deliveryBreakdown && <DeliveryBreakdown b={order.deliveryBreakdown as unknown as FeeBreakdown} />}
          <div className="flex justify-between font-bold text-terracotta"><span>Total</span><span>{formatCents(order.totalCents)}</span></div>
          <p className="text-ink/60">
            Pagamento: {PAYMENT[order.paymentMethod]}
            {order.changeForCents ? ` · troco para ${formatCents(order.changeForCents)}` : ""}
          </p>
          {order.paymentMethod === "PIX" && order.store.pixKey && (
            <p className="text-ink/60">Chave Pix: <strong className="select-all">{order.store.pixKey}</strong></p>
          )}
        </div>
        {address && (
          <p className="text-sm text-ink/70">
            {address.street}, {address.number}
            {address.complement ? ` · ${address.complement}` : ""} · {address.district} · {address.city}/{address.state}
          </p>
        )}
      </section>

      <a
        href={waLink(`Olá! Sobre o meu pedido ${order.code}`).replace(/wa\.me\/\d+/, `wa.me/${order.store.whatsapp}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary w-full"
      >
        <WhatsAppIcon className="size-4" /> Falar com a loja
      </a>
    </div>
  );
}
