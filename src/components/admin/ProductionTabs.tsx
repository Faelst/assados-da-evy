import Link from "next/link";
import { CalendarDays, CalendarRange, ListChecks } from "lucide-react";
import { weekdayOf, type LocalDate } from "@/server/domain/time";
import { can } from "@/server/session";
import type { Role } from "@/server/domain/order-status";

/** Abas que ligam Semana ↔ Dia ↔ Plano semanal, mantendo a data em foco. */
export function ProductionTabs({ active, date, role }: { active: "semana" | "dia" | "plano"; date: LocalDate; role: Role }) {
  const tabs = [
    { id: "semana", label: "Semana", href: `/admin/agenda?semana=${date}`, icon: CalendarRange, show: true },
    { id: "dia", label: "Dia", href: `/admin/fornadas?data=${date}`, icon: CalendarDays, show: true },
    { id: "plano", label: "Plano semanal", href: `/admin/plano-de-fornadas?dia=${weekdayOf(date)}&data=${date}`, icon: ListChecks, show: can(role, "plano-de-fornadas") },
  ] as const;
  return (
    <nav className="no-print mb-5 flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-terracotta/15" aria-label="Agenda e fornadas">
      {tabs
        .filter((t) => t.show)
        .map(({ id, label, href, icon: Icon }) => (
          <Link
            key={id}
            href={href}
            aria-current={active === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
              active === id ? "bg-terracotta text-cream" : "text-ink/70 hover:bg-terracotta/10"
            }`}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
    </nav>
  );
}
