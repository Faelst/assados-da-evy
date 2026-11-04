import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { ACTION_LABEL, STATUS_LABEL, nextStatuses } from "@/server/domain/order-status";
import { utcToLocalHHmm } from "@/server/domain/time";
import { formatCents, maskPhone } from "@/lib/phone";
import { WhatsAppIcon } from "@/components/icons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatusActions } from "@/components/admin/StatusActions";
import { PrintButton } from "@/components/admin/PrintButton";
import { markPaidAction } from "../actions";

const PAYMENT = { PIX: "Pix", CASH: "Dinheiro", CARD: "Cartão" } as const;

export default async function PedidoAdmin({ params }: PageProps<"/admin/pedidos/[id]">) {
  const s = await requireSection("pedidos");
  const { id } = await params;
  const order = await db.order.findFirst({
    where: { id, storeId: s.storeId },
    include: {
      customer: true,
      items: { include: { batches: { include: { batch: true } } } },
      history: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      store: true,
    },
  });
  if (!order) notFound();
  const tz = order.store.timezone;
  const fmt = (d: Date) => `${d.toLocaleDateString("pt-BR", { timeZone: tz })} ${utcToLocalHHmm(d, tz)}`;
  const next = nextStatuses(order.status, { type: order.type, fulfillment: order.fulfillment, role: s.role }).map((st) => ({
    status: st,
    label: ACTION_LABEL[st] ?? STATUS_LABEL[st],
  }));
  const address = order.addressSnapshot as Record<string, string> | null;
  const phone = order.customer.phone;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/pedidos" className="no-print btn-ghost -ml-3"><ArrowLeft className="size-4" /> Pedidos</Link>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-3xl font-bold text-terracotta-dark">{order.code}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-lg font-semibold">
          {order.type === "SCHEDULED" ? "Encomenda" : "Pronta entrega"} · {order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
          {order.handoffAt && ` · ${fmt(order.handoffAt)}`}
        </p>
        <p className="text-sm text-ink/60">Feito em {fmt(order.createdAt)}</p>
        {order.cancelReason && <p className="text-sm font-semibold text-tomato">Cancelado: {order.cancelReason}</p>}
        <div className="no-print">
          <StatusActions orderId={order.id} next={next} />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-xl font-bold">Cliente</h2>
        <p className="font-semibold">{order.customer.name}</p>
        <p className="flex items-center gap-2 text-sm">
          {maskPhone(phone)}
          <a className="no-print btn-ghost" href={`https://wa.me/55${phone}?text=${encodeURIComponent(`Olá ${order.customer.name}! Sobre o pedido ${order.code} da Assados da Evy:`)}`} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="size-4" /> WhatsApp
          </a>
        </p>
        {address && (
          <div className="rounded-2xl bg-cream p-3 text-sm">
            <p className="font-semibold">{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ""}</p>
            <p>{address.district} · {address.city}/{address.state} · CEP {address.cep}</p>
            {address.reference && <p>Referência: {address.reference}</p>}
            {address.notes && <p>Entregador: {address.notes}</p>}
            {order.deliveryDistanceKm != null && (
              <p className="mt-1 font-semibold">
                {order.deliveryDistanceKm.toLocaleString("pt-BR")} km · ~{order.deliveryDurationMin} min de rota
              </p>
            )}
            <a
              className="no-print btn-ghost -ml-3 mt-1"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(`${address.street}, ${address.number} - ${address.district}, ${address.city} - ${address.state}, ${address.cep}`)}`}
            >
              Abrir rota no mapa
            </a>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-xl font-bold">Itens</h2>
        <ul className="divide-y divide-terracotta/10">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                <span className="font-semibold">{i.qty}× {i.nameSnapshot}</span>
                {i.notes && <span className="block text-sm text-ink/60">Obs.: {i.notes}</span>}
                {i.batches.length > 0 && (
                  <span className="block text-xs text-ink/50">
                    Fornada: {i.batches.map((b) => `${utcToLocalHHmm(b.batch.startsAt, tz)}–${utcToLocalHHmm(b.batch.readyAt, tz)} (${b.units})`).join(", ")}
                  </span>
                )}
              </span>
              <span className="tabular-nums">{formatCents(i.qty * i.unitPriceCents)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-terracotta/10 pt-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCents(order.subtotalCents)}</span></div>
          {order.deliveryFeeCents > 0 && <div className="flex justify-between"><span>Entrega</span><span>{formatCents(order.deliveryFeeCents)}</span></div>}
          <div className="flex justify-between text-lg font-bold text-terracotta"><span>Total</span><span>{formatCents(order.totalCents)}</span></div>
          <p>
            Pagamento: <strong>{PAYMENT[order.paymentMethod]}</strong>
            {order.changeForCents ? ` · troco para ${formatCents(order.changeForCents)}` : ""} ·{" "}
            {order.paymentStatus === "PAID" ? <span className="font-semibold text-emerald-700">Pago</span> : "Pendente"}
          </p>
          {order.paymentStatus !== "PAID" && s.role !== "KITCHEN" && order.status !== "CANCELLED" && (
            <form action={markPaidAction} className="no-print">
              <input type="hidden" name="orderId" value={order.id} />
              <button className="btn-ghost -ml-3">Marcar como pago</button>
            </form>
          )}
        </div>
        {order.notes && <p className="rounded-2xl bg-amber/15 p-3 text-sm"><strong>Observações:</strong> {order.notes}</p>}
      </section>

      <section className="card no-print">
        <h2 className="mb-2 font-display text-xl font-bold">Histórico</h2>
        <ol className="space-y-1 text-sm">
          {order.history.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2">
              <span className="text-ink/50">{fmt(h.createdAt)}</span>
              <span className="font-semibold">{STATUS_LABEL[h.toStatus]}</span>
              {h.user && <span className="text-ink/60">por {h.user.name}</span>}
              {h.reason && <span className="text-ink/60">· {h.reason}</span>}
            </li>
          ))}
        </ol>
      </section>

      <div className="no-print flex justify-end"><PrintButton /></div>
    </div>
  );
}
