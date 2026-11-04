import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { batchDetail, weekAgenda, weekStartOf, type AgendaBatch } from "@/server/services/agenda";
import { addDays, minutesOf, todayIn, weekdayOf, WEEKDAYS_PT } from "@/server/domain/time";
import { PageHeader } from "@/components/admin/PageHeader";
import { BatchOrdersPanel } from "@/components/admin/BatchOrdersPanel";
import { ProductionTabs } from "@/components/admin/ProductionTabs";

const HOUR_PX = 64;

function BatchCard({ b, href, compact }: { b: AgendaBatch; href: string; compact?: boolean }) {
  const pct = Math.min(100, Math.round(((b.usedUnits + b.heldUnits) / b.capacityUnits) * 100));
  return (
    <Link
      href={href}
      scroll={false}
      title="Ver os pedidos desta fornada"
      className={`block h-full overflow-hidden rounded-xl border bg-white p-2 text-left shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-terracotta/30 ${b.blocked ? "border-ink/20 opacity-60" : "border-terracotta/30"}`}
    >
      <p className="truncate text-xs font-bold text-terracotta-dark">{b.productName}</p>
      <p className="text-[11px] text-ink/60">
        {b.start}–{b.end} {b.blocked && "· bloqueada"}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
          <span className="block h-full bg-terracotta" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-[11px] font-bold tabular-nums">{b.usedUnits}/{b.capacityUnits}</span>
      </div>
      {b.orders.length > 0 && (
        <p className="mt-1 truncate text-[11px] font-semibold text-ink/70">
          {b.orders.length} pedido(s){compact ? ` · ${b.orders.map((o) => o.customer).join(", ")}` : ""}
        </p>
      )}
    </Link>
  );
}

export default async function Agenda({ searchParams }: PageProps<"/admin/agenda">) {
  const session = await requireSection("agenda");
  const store = await getStore();
  const sp = await searchParams;
  const today = todayIn(store.timezone);
  const ref = typeof sp.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : today;
  const start = weekStartOf(ref);
  const days = await weekAgenda(store.id, start);
  const weekHref = ref === today ? "/admin/agenda" : `/admin/agenda?semana=${ref}`;
  const batchHref = (id: string) => `/admin/agenda?${new URLSearchParams({ ...(ref !== today && { semana: ref }), fornada: id })}`;
  const opened = typeof sp.fornada === "string" ? await batchDetail(store.id, sp.fornada) : null;

  const all = days.flatMap((d) => d.batches);
  const minHour = Math.min(8, ...all.map((b) => Math.floor(minutesOf(b.start) / 60)));
  const maxHour = Math.max(18, ...all.map((b) => Math.ceil(minutesOf(b.end) / 60)));
  const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  const label = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  return (
    <>
      <ProductionTabs active="semana" date={ref} role={session.role} />
      <PageHeader
        title="Agenda da semana"
        subtitle={`${label(start)} a ${label(addDays(start, 6))} · toque numa fornada para ver todos os pedidos dela, ou no dia para ajustar`}
        actions={
          <>
            <Link href={`/admin/agenda?semana=${addDays(start, -7)}`} className="btn-secondary px-3" aria-label="Semana anterior"><ChevronLeft className="size-4" /></Link>
            <Link href="/admin/agenda" className="btn-secondary">Esta semana</Link>
            <Link href={`/admin/agenda?semana=${addDays(start, 7)}`} className="btn-secondary px-3" aria-label="Próxima semana"><ChevronRight className="size-4" /></Link>
          </>
        }
      />

      {/* desktop: grade dias × horas */}
      <div className="card hidden overflow-x-auto p-0 lg:block">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => (
            <Link
              key={d.date}
              href={`/admin/fornadas?data=${d.date}`}
              title="Abrir o dia"
              className={`border-b border-l border-terracotta/10 p-2 text-center transition hover:bg-terracotta/10 ${d.date === today ? "bg-amber/15" : ""}`}
            >
              <p className="text-xs font-bold uppercase text-ink/50">{WEEKDAYS_PT[weekdayOf(d.date)].slice(0, 3)}</p>
              <p className="font-display text-lg font-bold">{label(d.date)}</p>
              <p className="text-[11px] font-semibold text-terracotta">
                {d.batches.reduce((n, b) => n + b.orders.length, 0)} pedido(s)
              </p>
            </Link>
          ))}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 text-[11px] text-ink/50" style={{ top: i * HOUR_PX - 6 }}>{String(h).padStart(2, "0")}:00</span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d.date} className={`relative border-l border-terracotta/10 ${d.date === today ? "bg-amber/5" : ""}`} style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-dashed border-terracotta/10" style={{ top: i * HOUR_PX }} />
              ))}
              {d.batches.map((b, idx) => {
                const top = ((minutesOf(b.start) - minHour * 60) / 60) * HOUR_PX;
                const height = ((minutesOf(b.end) - minutesOf(b.start)) / 60) * HOUR_PX;
                const overlapping = d.batches.filter((o) => minutesOf(o.start) < minutesOf(b.end) && minutesOf(b.start) < minutesOf(o.end));
                const col = overlapping.indexOf(b);
                const width = 100 / overlapping.length;
                return (
                  <div
                    key={b.id ?? idx}
                    className="absolute p-0.5"
                    style={{ top, left: `${col * width}%`, width: `${width}%`, height }}
                  >
                    <BatchCard b={b} href={batchHref(b.id)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* celular: lista por dia */}
      <div className="space-y-4 lg:hidden">
        {days.map((d) => (
          <section key={d.date} className={`card ${d.date === today ? "ring-2 ring-amber" : ""}`}>
            <h2 className="mb-2 flex items-center justify-between font-display text-lg font-bold">
              {WEEKDAYS_PT[weekdayOf(d.date)]} · {label(d.date)}
              <Link href={`/admin/fornadas?data=${d.date}`} className="btn-ghost text-sm">Abrir dia</Link>
            </h2>
            {d.batches.length === 0 ? (
              <p className="text-sm text-ink/50">Sem fornadas.</p>
            ) : (
              <div className="space-y-2">
                {d.batches.map((b) => <BatchCard key={b.id} b={b} href={batchHref(b.id)} compact />)}
              </div>
            )}
          </section>
        ))}
      </div>

      {opened && <BatchOrdersPanel batch={opened} closeHref={weekHref} role={session.role} />}
    </>
  );
}
