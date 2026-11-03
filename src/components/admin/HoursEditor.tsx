"use client";

import { TimeSelect } from "@/components/admin/TimeSelect";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { WEEKDAYS_PT } from "@/server/domain/time";
import { saveHoursAction } from "@/app/admin/(painel)/horarios/actions";

type Row = { weekday: number; opensAt: string; closesAt: string };

export function HoursEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const update = (idx: number, patch: Partial<Row>) => setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const dayRows = rows.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === d);
        return (
          <section key={d} className="card flex flex-wrap items-center gap-3 p-4">
            <h2 className="w-24 font-display text-lg font-bold">{WEEKDAYS_PT[d]}</h2>
            <div className="flex flex-1 flex-wrap gap-2">
              {dayRows.length === 0 && <span className="chip bg-ink/10 text-ink/60">Fechado</span>}
              {dayRows.map(({ r, i }) => (
                <span key={i} className="flex items-center gap-1 rounded-2xl bg-cream p-1">
                  <TimeSelect className="w-24 py-1.5" value={r.opensAt} onChange={(v) => update(i, { opensAt: v })} aria-label="Abre" />
                  <span>às</span>
                  <TimeSelect className="w-24 py-1.5" value={r.closesAt} onChange={(v) => update(i, { closesAt: v })} aria-label="Fecha" />
                  <button type="button" aria-label="Remover turno" className="px-1 text-ink/40 hover:text-tomato" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </button>
                </span>
              ))}
            </div>
            <button type="button" className="btn-ghost" onClick={() => setRows([...rows, { weekday: d, opensAt: "09:00", closesAt: "18:00" }])}>
              <Plus className="size-4" /> Turno
            </button>
          </section>
        );
      })}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-tomato"}`}>{msg.text}</p>}
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveHoursAction(rows);
              setMsg(
                r.ok
                  ? { ok: true, text: r.conflicts ? `Salvo. ${r.conflicts} fornada(s) vendida(s) ficaram fora do novo horário; confira em Fornadas por data.` : "Horários salvos." }
                  : { ok: false, text: r.error },
              );
            })
          }
        >
          {pending ? "Salvando…" : "Salvar horários"}
        </button>
      </div>
    </div>
  );
}
