import Link from "next/link";
import { ChefHat, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { can } from "@/server/session";
import { getStore } from "@/server/store";
import { dayAgenda } from "@/server/services/agenda";
import { releaseExpiredHolds } from "@/server/services/batches";
import { addDays, todayIn, weekdayOf, WEEKDAYS_PT } from "@/server/domain/time";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductionTabs } from "@/components/admin/ProductionTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AddBatchForm } from "@/components/admin/AddBatchForm";
import { removeBatchAction, updateBatchAction } from "./actions";

export default async function DiaDeFornadas({ searchParams }: PageProps<"/admin/fornadas">) {
  const session = await requireSection("agenda");
  const canEdit = can(session.role, "fornadas");
  const canPlan = can(session.role, "plano-de-fornadas");
  const store = await getStore();
  const sp = await searchParams;
  const today = todayIn(store.timezone);
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today;
  await releaseExpiredHolds();
  const [day, products] = await Promise.all([
    dayAgenda(store.id, date),
    canEdit
      ? db.product.findMany({ where: { storeId: store.id, active: true, saleModes: { has: "SCHEDULED" } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const weekday = WEEKDAYS_PT[weekdayOf(date)];
  const totalOrders = day.batches.reduce((n, b) => n + b.orders.length, 0);
  const totalUnits = day.batches.reduce((n, b) => n + b.usedUnits, 0);

  return (
    <>
      <ProductionTabs active="dia" date={date} role={session.role} />
      <PageHeader
        title={`${weekday}, ${date.split("-").reverse().join("/")}${date === today ? " (hoje)" : ""}`}
        subtitle={`${day.batches.length} fornada(s) · ${totalOrders} pedido(s) · ${totalUnits} unidade(s) vendidas`}
        actions={
          <>
            <Link href={`/admin/fornadas?data=${addDays(date, -1)}`} className="btn-secondary px-3" aria-label="Dia anterior"><ChevronLeft className="size-4" /></Link>
            <form className="flex gap-2">
              <input type="date" name="data" defaultValue={date} className="input w-40" aria-label="Escolher data" />
              <button className="btn-secondary">Ir</button>
            </form>
            <Link href={`/admin/fornadas?data=${addDays(date, 1)}`} className="btn-secondary px-3" aria-label="Próximo dia"><ChevronRight className="size-4" /></Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {canPlan && (
          <Link href={`/admin/plano-de-fornadas?dia=${weekdayOf(date)}&data=${date}`} className="btn-ghost">
            <ListChecks className="size-4" /> Editar plano de toda {weekday.toLowerCase()}
          </Link>
        )}
        <Link href={`/admin/producao?data=${date}`} className="btn-ghost"><ChefHat className="size-4" /> Lista de produção do dia</Link>
      </div>

      {day.batches.length === 0 ? (
        <p className="card mb-4 text-center text-ink/60">
          Nenhuma fornada nesta data (cozinha fechada ou dia sem plano).
          {canPlan && " Monte o plano semanal ou crie uma fornada extra abaixo."}
        </p>
      ) : (
        <div className="mb-4 space-y-3">
          {day.batches.map((b) => {
            const pct = Math.min(100, Math.round(((b.usedUnits + b.heldUnits) / b.capacityUnits) * 100));
            return (
              <section key={b.id} className={`card space-y-3 ${b.blocked ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-xl font-bold tabular-nums">{b.start}–{b.end}</span>
                  <span className="text-lg font-semibold">{b.productName}</span>
                  {b.manual && <span className="chip bg-sky-100 text-sky-800">extra</span>}
                  {b.blocked && <span className="chip bg-ink/10 text-ink/70">bloqueada</span>}
                  <span className="ml-auto flex items-center gap-2">
                    <span className="h-2 w-32 overflow-hidden rounded-full bg-cream-deep">
                      <span className="block h-full bg-terracotta" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-sm font-bold tabular-nums">{b.usedUnits}/{b.capacityUnits}</span>
                    {b.heldUnits > 0 && <span className="text-xs text-ink/60">+{b.heldUnits} reservadas</span>}
                  </span>
                </div>

                {b.orders.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {b.orders.map((o) => (
                      <li key={o.orderId}>
                        <Link href={`/admin/pedidos/${o.orderId}`} className="flex flex-wrap items-center gap-2 rounded-2xl bg-cream/70 p-2 text-sm hover:bg-cream">
                          <strong>{o.code}</strong> {o.customer}
                          <span className="w-full text-ink/60">{o.items} · {o.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}</span>
                          <StatusBadge status={o.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink/50">Sem pedidos nesta fornada.</p>
                )}

                {canEdit && (
                  <form action={updateBatchAction} className="flex flex-wrap items-center gap-3 border-t border-terracotta/10 pt-3">
                    <input type="hidden" name="id" value={b.id} />
                    <label className="flex items-center gap-1 text-sm">
                      Capacidade
                      <input type="number" name="capacity" min={b.usedUnits + b.heldUnits} defaultValue={b.capacityUnits} className="input w-20 py-1.5" />
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="blocked" defaultChecked={b.blocked} className="accent-terracotta" /> Bloquear novas encomendas
                    </label>
                    <button className="btn-secondary px-4 py-1.5 text-sm">Salvar</button>
                    {b.manual && b.usedUnits === 0 && b.heldUnits === 0 && (
                      <button formAction={removeBatchAction} className="btn-ghost text-tomato">Remover fornada extra</button>
                    )}
                  </form>
                )}
              </section>
            );
          })}
        </div>
      )}

      {canEdit && (
        <section className="card">
          <h2 className="mb-2 font-display text-lg font-bold">Fornada extra só nesta data</h2>
          <AddBatchForm date={date} products={products} />
          <p className="mt-3 text-sm text-ink/60">
            Para tirar uma fornada do plano só neste dia, bloqueie. Para mudar todas as {weekday.toLowerCase()}s, edite o plano semanal.
          </p>
        </section>
      )}
    </>
  );
}
