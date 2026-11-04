import Link from "next/link";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { addDays, dateColumn, todayIn, utcToLocalHHmm, zonedToUtc } from "@/server/domain/time";
import { STATUS_LABEL, type OrderStatus } from "@/server/domain/order-status";
import { weekStartOf } from "@/server/services/agenda";
import { ensureBatches } from "@/server/services/batches";
import { formatCents } from "@/lib/phone";
import { PageHeader } from "@/components/admin/PageHeader";

export default async function Dashboard() {
  await requireSection("dashboard");
  const store = await getStore();
  const today = todayIn(store.timezone);
  const startToday = zonedToUtc(today, "00:00", store.timezone);
  const startTomorrow = zonedToUtc(addDays(today, 1), "00:00", store.timezone);
  const startWeek = zonedToUtc(weekStartOf(today), "00:00", store.timezone);

  await ensureBatches(store.id, today, addDays(today, 1));
  const [todayOrders, revenueToday, revenueWeek, batches, lowStock] = await Promise.all([
    db.order.groupBy({
      by: ["status"],
      where: {
        storeId: store.id,
        OR: [
          { type: "READY", createdAt: { gte: startToday, lt: startTomorrow } },
          { type: "SCHEDULED", scheduledDate: dateColumn(today) },
        ],
      },
      _count: true,
    }),
    db.order.aggregate({ where: { storeId: store.id, status: { not: "CANCELLED" }, createdAt: { gte: startToday } }, _sum: { totalCents: true } }),
    db.order.aggregate({ where: { storeId: store.id, status: { not: "CANCELLED" }, createdAt: { gte: startWeek } }, _sum: { totalCents: true } }),
    db.productionBatch.findMany({
      where: { storeId: store.id, readyAt: { gte: new Date() }, date: { lte: dateColumn(addDays(today, 1)) } },
      include: { product: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
    db.dailyMenuItem.findMany({
      where: { dailyMenu: { storeId: store.id, date: dateColumn(today) }, qtyAvailable: { lte: 3 } },
      include: { product: { select: { name: true } } },
    }),
  ]);

  const counts = new Map(todayOrders.map((g) => [g.status, g._count]));
  const shown: OrderStatus[] = ["AWAITING_CONFIRMATION", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

  return (
    <>
      <PageHeader title="Início" subtitle={`Hoje, ${today.split("-").reverse().join("/")}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-display text-xl font-bold">Pedidos de hoje</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {shown.map((s) => (
              <Link key={s} href={`/admin/pedidos?status=${s}`} className="rounded-2xl bg-cream p-3 transition hover:bg-cream-deep">
                <p className="font-display text-3xl font-bold text-terracotta">{counts.get(s) ?? 0}</p>
                <p className="text-xs font-semibold text-ink/70">{STATUS_LABEL[s]}</p>
              </Link>
            ))}
          </div>
        </section>
        <section className="card">
          <h2 className="mb-3 font-display text-xl font-bold">Faturamento</h2>
          <p className="text-sm text-ink/60">Hoje</p>
          <p className="font-display text-2xl font-bold">{formatCents(revenueToday._sum.totalCents ?? 0)}</p>
          <p className="mt-2 text-sm text-ink/60">Esta semana</p>
          <p className="font-display text-2xl font-bold">{formatCents(revenueWeek._sum.totalCents ?? 0)}</p>
        </section>
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Próximas fornadas</h2>
            <Link href="/admin/agenda" className="btn-ghost">Ver agenda</Link>
          </div>
          {batches.length === 0 ? (
            <p className="text-sm text-ink/60">Nenhuma fornada até amanhã.</p>
          ) : (
            <ul className="space-y-2">
              {batches.map((b) => {
                const pct = Math.round((b.usedUnits / b.capacityUnits) * 100);
                return (
                  <li key={b.id} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-semibold">
                      {b.date.toISOString().slice(5, 10).split("-").reverse().join("/")} {utcToLocalHHmm(b.startsAt, store.timezone)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{b.product.name}</span>
                    <span className="h-2 w-24 overflow-hidden rounded-full bg-cream-deep">
                      <span className="block h-full bg-terracotta" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-14 text-right text-sm tabular-nums">{b.usedUnits}/{b.capacityUnits}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Estoque acabando</h2>
            <Link href="/admin/cardapio-do-dia" className="btn-ghost">Ajustar</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-ink/60">Tudo certo por aqui.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {lowStock.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.product.name}</span>
                  <span className={`font-bold ${i.qtyAvailable === 0 ? "text-tomato" : ""}`}>{i.qtyAvailable === 0 ? "Esgotado" : i.qtyAvailable}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
