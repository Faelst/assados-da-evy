import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { dateColumn, fromDateColumn, todayIn, weekdayOf, WEEKDAYS_PT } from "@/server/domain/time";
import { PageHeader } from "@/components/admin/PageHeader";
import { ExceptionForm } from "@/components/admin/ExceptionForm";
import { deleteExceptionAction } from "./actions";

const TYPE = { CLOSED: "Fechado", SPECIAL_HOURS: "Horário especial", SPECIAL_MENU: "Cardápio especial" } as const;

export default async function Excecoes() {
  await requireSection("excecoes");
  const store = await getStore();
  const [list, products] = await Promise.all([
    db.calendarException.findMany({
      where: { storeId: store.id, date: { gte: dateColumn(todayIn(store.timezone)) } },
      include: { plan: { include: { product: { select: { name: true } } }, orderBy: { startTime: "asc" } } },
      orderBy: { date: "asc" },
    }),
    db.product.findMany({ where: { storeId: store.id, active: true, saleModes: { has: "SCHEDULED" } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Feriados e exceções" subtitle="Datas que fogem da semana normal: dia fechado, horário diferente ou cardápio especial." />
      <section className="card mb-4">
        <h2 className="mb-3 font-display text-lg font-bold">Nova exceção</h2>
        <ExceptionForm products={products} />
      </section>
      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold">Próximas exceções</h2>
        {list.length === 0 ? (
          <p className="text-sm text-ink/60">Nenhuma exceção cadastrada.</p>
        ) : (
          <ul className="divide-y divide-terracotta/10">
            {list.map((e) => {
              const d = fromDateColumn(e.date);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-40 font-semibold">{WEEKDAYS_PT[weekdayOf(d)].slice(0, 3)} {d.split("-").reverse().join("/")}</span>
                  <span className="chip bg-terracotta/10 text-terracotta">{TYPE[e.type]}</span>
                  <span className="flex-1 text-sm text-ink/70">
                    {e.opensAt && `${e.opensAt}–${e.closesAt} `}
                    {e.plan.length > 0 && e.plan.map((p) => `${p.startTime} ${p.product.name}`).join(", ")}
                    {e.note && ` · ${e.note}`}
                  </span>
                  <form action={deleteExceptionAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="btn-ghost text-tomato">Excluir</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
