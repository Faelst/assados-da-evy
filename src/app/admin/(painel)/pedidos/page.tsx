import Link from "next/link";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { STATUS_LABEL, type OrderStatus } from "@/server/domain/order-status";
import { dateColumn, todayIn, utcToLocalHHmm, zonedToUtc, addDays } from "@/server/domain/time";
import { formatCents } from "@/lib/phone";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";

const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];

export default async function Pedidos({ searchParams }: PageProps<"/admin/pedidos">) {
  await requireSection("pedidos");
  const store = await getStore();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const type = sp.tipo === "READY" || sp.tipo === "SCHEDULED" ? sp.tipo : undefined;
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: Prisma.OrderWhereInput = { storeId: store.id };
  if (status) where.status = status;
  if (type) where.type = type;
  if (date) {
    where.OR = [
      { type: "SCHEDULED", scheduledDate: dateColumn(date) },
      { type: "READY", createdAt: { gte: zonedToUtc(date, "00:00", store.timezone), lt: zonedToUtc(addDays(date, 1), "00:00", store.timezone) } },
    ];
  }
  if (q) where.AND = [{ OR: [{ code: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }, { customer: { phone: { contains: q.replace(/\D/g, "") || q } } }] }];

  const orders = await db.order.findMany({
    where,
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const today = todayIn(store.timezone);
  const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: store.timezone, day: "2-digit", month: "2-digit" }) + " " + utcToLocalHHmm(d, store.timezone);

  return (
    <>
      <PageHeader title="Pedidos" subtitle="Os pedidos novos aparecem sozinhos, com um alerta sonoro." />
      <form className="card mb-4 grid gap-2 p-4 sm:grid-cols-5">
        <input name="q" defaultValue={q} placeholder="Código, nome ou telefone" className="input sm:col-span-2" />
        <select name="status" defaultValue={status ?? ""} className="input">
          <option value="">Todos os status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select name="tipo" defaultValue={type ?? ""} className="input">
          <option value="">Pronta entrega e encomenda</option>
          <option value="READY">Pronta entrega</option>
          <option value="SCHEDULED">Encomenda</option>
        </select>
        <div className="flex gap-2">
          <input type="date" name="data" defaultValue={date ?? ""} className="input" />
          <button className="btn-primary px-4">Filtrar</button>
        </div>
        <div className="flex gap-2 text-sm sm:col-span-5">
          <Link href={`/admin/pedidos?data=${today}`} className="btn-ghost">Hoje</Link>
          <Link href="/admin/pedidos?status=AWAITING_CONFIRMATION" className="btn-ghost">Aguardando confirmação</Link>
          <Link href="/admin/pedidos" className="btn-ghost">Limpar filtros</Link>
        </div>
      </form>

      {orders.length === 0 ? (
        <p className="card text-center text-ink/60">Nenhum pedido encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/pedidos/${o.id}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition hover:shadow-md">
                <span className="w-24 font-display text-lg font-bold text-terracotta">{o.code}</span>
                <span className="min-w-40 flex-1">
                  <span className="block font-semibold">{o.customer.name}</span>
                  <span className="block truncate text-xs text-ink/60">{o.items.map((i) => `${i.qty}× ${i.nameSnapshot}`).join(", ")}</span>
                </span>
                <span className="text-sm">
                  <span className="block font-semibold">{o.type === "SCHEDULED" ? "Encomenda" : "Pronta entrega"} · {o.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}</span>
                  <span className="block text-xs text-ink/60">{o.type === "SCHEDULED" && o.handoffAt ? `Para ${fmt(o.handoffAt)}` : `Feito ${fmt(o.createdAt)}`}</span>
                </span>
                <span className="w-24 text-right font-bold tabular-nums">{formatCents(o.totalCents)}</span>
                <StatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
