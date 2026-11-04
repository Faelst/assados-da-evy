import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { productionDay } from "@/server/services/agenda";
import { ensureBatches } from "@/server/services/batches";
import { addDays, todayIn, weekdayOf, WEEKDAYS_PT } from "@/server/domain/time";
import { PageHeader } from "@/components/admin/PageHeader";
import { PrintButton } from "@/components/admin/PrintButton";

export default async function Producao({ searchParams }: PageProps<"/admin/producao">) {
  await requireSection("producao");
  const store = await getStore();
  const sp = await searchParams;
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : todayIn(store.timezone);
  await ensureBatches(store.id, date, date);
  const lines = await productionDay(store.id, date);
  const title = `${WEEKDAYS_PT[weekdayOf(date)]}, ${date.split("-").reverse().join("/")}`;

  return (
    <>
      <PageHeader
        title="Produção do dia"
        subtitle={title}
        actions={
          <>
            <Link href={`/admin/producao?data=${addDays(date, -1)}`} className="btn-secondary px-3" aria-label="Dia anterior"><ChevronLeft className="size-4" /></Link>
            <Link href="/admin/producao" className="btn-secondary">Hoje</Link>
            <Link href={`/admin/producao?data=${addDays(date, 1)}`} className="btn-secondary px-3" aria-label="Próximo dia"><ChevronRight className="size-4" /></Link>
            <PrintButton />
          </>
        }
      />
      <h2 className="mb-3 hidden font-display text-2xl font-bold print:block">Produção · {title}</h2>
      {lines.length === 0 ? (
        <p className="card text-center text-ink/60">Nenhuma encomenda para produzir nesta data.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lines.map((l) => (
            <section key={l.productId} className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-bold">{l.productName}</h3>
                <span className="font-display text-3xl font-bold text-terracotta">{l.totalUnits}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {l.batches.map((b) => (
                  <li key={b.start} className="flex justify-between">
                    <span>Forno {b.start} → pronto {b.ready}</span>
                    <strong>{b.units} un</strong>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-4 text-sm text-ink/60">Pronta entrega é controlada pelo estoque do dia e não entra nesta lista.</p>
    </>
  );
}
