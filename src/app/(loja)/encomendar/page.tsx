import Link from "next/link";
import { getStore } from "@/server/store";
import { availableDates } from "@/server/services/booking";
import { WEEKDAYS_PT, weekdayOf } from "@/server/domain/time";

export const metadata = { title: "Encomendar — Assados da Evy" };

const STATUS = {
  AVAILABLE: { label: "Disponível", cls: "bg-emerald-100 text-emerald-800" },
  FEW: { label: "Poucas vagas", cls: "bg-amber/30 text-terracotta-dark" },
  SOLD_OUT: { label: "Esgotado", cls: "bg-ink/10 text-ink/60" },
  CLOSED: { label: "Fechado", cls: "bg-ink/5 text-ink/40" },
} as const;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function Encomendar() {
  const store = await getStore();
  const dates = await availableDates(store.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-terracotta-dark">Encomendar</h1>
        <p className="text-ink/70">Cada dia tem a sua fornada. Escolha a data para ver as receitas e os horários.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {dates.map((d) => {
          const [, m, day] = d.date.split("-").map(Number);
          const st = STATUS[d.status];
          const bookable = d.status === "AVAILABLE" || d.status === "FEW";
          const body = (
            <>
              <span className="text-xs font-bold uppercase tracking-wide text-ink/50">{WEEKDAYS_PT[weekdayOf(d.date)]}</span>
              <span className="font-display text-2xl font-bold text-ink">
                {day} <span className="text-base font-semibold text-ink/50">{MONTHS[m - 1]}</span>
              </span>
              {d.products.length > 0 && <span className="line-clamp-2 text-sm text-ink/70">{d.products.join(", ")}</span>}
              <span className={`chip mt-auto self-start ${st.cls}`}>{st.label}</span>
            </>
          );
          return (
            <li key={d.date}>
              {bookable ? (
                <Link href={`/encomendar/${d.date}`} className="card flex h-full flex-col gap-1 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                  {body}
                </Link>
              ) : (
                <div className="card flex h-full flex-col gap-1 p-4 opacity-60" aria-disabled>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
