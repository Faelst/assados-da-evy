import Link from "next/link";
import { ExternalLink, MapPin, X } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import type { batchDetail } from "@/server/services/agenda";
import { ACTION_LABEL, STATUS_LABEL, nextStatuses } from "@/server/domain/order-status";
import { utcToLocalHHmm } from "@/server/domain/time";
import { formatCents, maskPhone } from "@/lib/phone";
import { WhatsAppIcon } from "@/components/icons";
import { StatusBadge } from "./StatusBadge";
import { StatusActions } from "./StatusActions";

const PAYMENT = { PIX: "Pix", CASH: "Dinheiro", CARD: "Cartão" } as const;

type Detail = NonNullable<Awaited<ReturnType<typeof batchDetail>>>;

/** Painel lateral da agenda: todos os pedidos de uma fornada, já abertos. */
export function BatchOrdersPanel({ batch, closeHref, role }: { batch: Detail; closeHref: string; role: Role }) {
  const tz = batch.timezone;
  const [y, m, d] = batch.date.split("-");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link href={closeHref} scroll={false} aria-label="Fechar" className="absolute inset-0 bg-ink/40" />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-cream shadow-2xl" aria-label={`Pedidos da fornada ${batch.productName}`}>
        <header className="flex items-start justify-between gap-3 border-b border-terracotta/15 bg-white p-4">
          <div>
            <p className="text-xs font-bold uppercase text-ink/50">{d}/{m}/{y} · {batch.start}–{batch.end}</p>
            <h2 className="font-display text-2xl font-bold text-terracotta-dark">{batch.productName}</h2>
            <p className="text-sm text-ink/70">
              {batch.orders.length} pedido(s) · {batch.usedUnits}/{batch.capacityUnits} unidades
              {batch.blocked && " · fornada bloqueada"}
            </p>
          </div>
          <Link href={closeHref} scroll={false} className="btn-ghost px-2" aria-label="Fechar">
            <X className="size-5" />
          </Link>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {batch.orders.length === 0 && <p className="card text-center text-ink/60">Nenhum pedido nesta fornada.</p>}
          {batch.orders.map((o) => {
            const address = o.addressSnapshot as Record<string, string> | null;
            const phone = o.customer.phone;
            const next = nextStatuses(o.status, { type: o.type, fulfillment: o.fulfillment, role }).map((st) => ({
              status: st,
              label: ACTION_LABEL[st] ?? STATUS_LABEL[st],
            }));
            const unitsHere = o.items.reduce((s, i) => s + i.batches.reduce((n, b) => n + b.units, 0), 0);
            return (
              <article key={o.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-xl font-bold">{o.code}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-sm font-semibold">
                  {o.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
                  {o.handoffAt && ` às ${utcToLocalHHmm(o.handoffAt, tz)}`} · {unitsHere} unidade(s) desta fornada
                </p>

                <div className="text-sm">
                  <p className="font-semibold">{o.customer.name}</p>
                  <p className="flex flex-wrap items-center gap-2">
                    {maskPhone(phone)}
                    <a
                      className="btn-ghost px-2 py-1"
                      href={`https://wa.me/55${phone}?text=${encodeURIComponent(`Olá ${o.customer.name}! Sobre o pedido ${o.code} da Assados da Evy:`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <WhatsAppIcon className="size-4" /> WhatsApp
                    </a>
                  </p>
                </div>

                {address && (
                  <div className="rounded-2xl bg-cream p-3 text-sm">
                    <p className="font-semibold">
                      {address.street}, {address.number}
                      {address.complement ? ` · ${address.complement}` : ""}
                    </p>
                    <p>{address.district} · {address.city}/{address.state} · CEP {address.cep}</p>
                    {address.reference && <p>Referência: {address.reference}</p>}
                    {address.notes && <p>Entregador: {address.notes}</p>}
                    <a
                      className="btn-ghost -ml-3 mt-1"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(`${address.street}, ${address.number} - ${address.district}, ${address.city} - ${address.state}, ${address.cep}`)}`}
                    >
                      <MapPin className="size-4" /> Rota no mapa
                    </a>
                  </div>
                )}

                <ul className="divide-y divide-terracotta/10 text-sm">
                  {o.items.map((i) => {
                    const here = i.batches.length > 0;
                    return (
                      <li key={i.id} className={`flex justify-between gap-3 py-1.5 ${here ? "" : "text-ink/45"}`}>
                        <span>
                          <span className="font-semibold">{i.qty}× {i.nameSnapshot}</span>
                          {!here && <span className="ml-1 text-xs">(outra fornada)</span>}
                          {i.notes && <span className="block text-xs text-ink/60">Obs.: {i.notes}</span>}
                        </span>
                        <span className="tabular-nums">{formatCents(i.qty * i.unitPriceCents)}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="space-y-0.5 border-t border-terracotta/10 pt-2 text-sm">
                  {o.deliveryFeeCents > 0 && (
                    <div className="flex justify-between"><span>Entrega</span><span>{formatCents(o.deliveryFeeCents)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-terracotta"><span>Total</span><span>{formatCents(o.totalCents)}</span></div>
                  <p>
                    {PAYMENT[o.paymentMethod]}
                    {o.changeForCents ? ` · troco para ${formatCents(o.changeForCents)}` : ""} ·{" "}
                    {o.paymentStatus === "PAID" ? <span className="font-semibold text-emerald-700">Pago</span> : "Pagamento pendente"}
                  </p>
                </div>

                {o.notes && <p className="rounded-2xl bg-amber/15 p-3 text-sm"><strong>Observações:</strong> {o.notes}</p>}

                <StatusActions orderId={o.id} next={next} />
                <Link href={`/admin/pedidos/${o.id}`} className="btn-ghost -ml-3 text-sm">
                  <ExternalLink className="size-4" /> Abrir pedido completo
                </Link>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
