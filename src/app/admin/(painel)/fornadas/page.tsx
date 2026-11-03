import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { ensureBatches, listDayBatches, releaseExpiredHolds } from "@/server/services/batches";
import { addDays, todayIn, utcToLocalHHmm, weekdayOf, WEEKDAYS_PT } from "@/server/domain/time";
import { PageHeader } from "@/components/admin/PageHeader";
import { AddBatchForm } from "@/components/admin/AddBatchForm";
import { removeBatchAction, updateBatchAction } from "./actions";

export default async function Fornadas({ searchParams }: PageProps<"/admin/fornadas">) {
  await requireSection("fornadas");
  const store = await getStore();
  const sp = await searchParams;
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : todayIn(store.timezone);
  await releaseExpiredHolds();
  await ensureBatches(store.id, date, date);
  const [batches, products] = await Promise.all([
    listDayBatches(store.id, date),
    db.product.findMany({ where: { storeId: store.id, active: true, saleModes: { has: "SCHEDULED" } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Fornadas por data"
        subtitle={`${WEEKDAYS_PT[weekdayOf(date)]}, ${date.split("-").reverse().join("/")} · bloqueie, mude a capacidade ou crie fornadas extras só nesta data`}
        actions={
          <form className="flex gap-2">
            <Link href={`/admin/fornadas?data=${addDays(date, -1)}`} className="btn-secondary px-3" aria-label="Dia anterior"><ChevronLeft className="size-4" /></Link>
            <input type="date" name="data" defaultValue={date} className="input w-40" />
            <button className="btn-secondary">Ir</button>
            <Link href={`/admin/fornadas?data=${addDays(date, 1)}`} className="btn-secondary px-3" aria-label="Próximo dia"><ChevronRight className="size-4" /></Link>
          </form>
        }
      />
      <section className="card mb-4 space-y-2">
        {batches.length === 0 && <p className="text-sm text-ink/60">Nenhuma fornada nesta data.</p>}
        {batches.map((b) => (
          <form key={b.id} action={updateBatchAction} className="flex flex-wrap items-center gap-3 rounded-2xl p-2 ring-1 ring-terracotta/10">
            <input type="hidden" name="id" value={b.id} />
            <span className="w-28 font-semibold">{utcToLocalHHmm(b.startsAt, store.timezone)}–{utcToLocalHHmm(b.readyAt, store.timezone)}</span>
            <span className="min-w-32 flex-1 font-semibold">{b.productName} {b.manual && <span className="chip bg-sky-100 text-sky-800">extra</span>}</span>
            <span className="text-sm text-ink/70">Vendidas {b.usedUnits} · reservadas {b.heldUnits}</span>
            <label className="flex items-center gap-1 text-sm">
              Capacidade
              <input type="number" name="capacity" min={b.usedUnits + b.heldUnits} defaultValue={b.capacityUnits} className="input w-20 py-1.5" />
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="blocked" defaultChecked={b.blocked} className="accent-terracotta" /> Bloqueada
            </label>
            <button className="btn-secondary px-4 py-1.5 text-sm">Salvar</button>
            {b.manual && b.usedUnits === 0 && b.heldUnits === 0 && (
              <button formAction={removeBatchAction} className="btn-ghost text-tomato">Remover</button>
            )}
          </form>
        ))}
      </section>
      <section className="card">
        <h2 className="mb-2 font-display text-lg font-bold">Fornada extra nesta data</h2>
        <AddBatchForm date={date} products={products} />
      </section>
      <p className="mt-3 text-sm text-ink/60">
        Para tirar uma fornada do plano só nesta data, marque como bloqueada. Para mudar todas as semanas, edite o Plano de fornadas.
      </p>
    </>
  );
}
