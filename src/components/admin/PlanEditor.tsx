"use client";

import { TimeSelect } from "@/components/admin/TimeSelect";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { fillDay } from "@/server/domain/production";
import { hhmmOf, minutesOf, WEEKDAYS_PT } from "@/server/domain/time";
import { savePlanAction } from "@/app/admin/(painel)/plano-de-fornadas/actions";

type Product = { id: string; name: string; batchSize: number; batchDurationMin: number };
type Row = { productId: string; startTime: string };

export function PlanEditor({
  products,
  hours,
  plan,
}: {
  products: Product[];
  hours: { weekday: number; opensAt: string; closesAt: string }[];
  plan: { weekday: number; productId: string; startTime: string }[];
}) {
  const [weekday, setWeekday] = useState(() => {
    const first = [1, 2, 3, 4, 5, 6, 0].find((d) => hours.some((h) => h.weekday === d));
    return first ?? 1;
  });
  const [rowsByDay, setRowsByDay] = useState<Record<number, Row[]>>(() => {
    const out: Record<number, Row[]> = {};
    for (let d = 0; d < 7; d++) out[d] = plan.filter((p) => p.weekday === d).map(({ productId, startTime }) => ({ productId, startTime }));
    return out;
  });
  const [fillProduct, setFillProduct] = useState(products[0]?.id ?? "");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shifts = hours.filter((h) => h.weekday === weekday);
  const rows = rowsByDay[weekday] ?? [];
  const setRows = (r: Row[]) => {
    setRowsByDay((s) => ({ ...s, [weekday]: r }));
    setErrors({});
    setMessage(null);
  };

  function save() {
    startTransition(async () => {
      const r = await savePlanAction(weekday, rows);
      if (r.ok) {
        setErrors({});
        setMessage({
          kind: "ok",
          text: r.conflicts
            ? `Plano salvo. Atenção: ${r.conflicts} fornada(s) já vendida(s) saíram do plano e foram mantidas. Veja em Fornadas por data.`
            : "Plano salvo. As próximas datas já foram atualizadas.",
        });
      } else {
        setErrors(Object.fromEntries(r.errors.map((e) => [e.index, e.code === "OVERLAP" ? "Sobrepõe outra fornada" : "Fora do horário da cozinha"])));
        setMessage({ kind: "error", text: "Ajuste as fornadas marcadas antes de salvar." });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-terracotta/15">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setWeekday(d);
              setErrors({});
              setMessage(null);
            }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${weekday === d ? "bg-terracotta text-cream" : "text-ink/70 hover:bg-terracotta/10"}`}
          >
            {WEEKDAYS_PT[d]}
            {(rowsByDay[d]?.length ?? 0) > 0 && <span className="ml-1 opacity-70">({rowsByDay[d].length})</span>}
          </button>
        ))}
      </div>

      <section className="card space-y-4">
        <p className="text-sm text-ink/70">
          Horário da cozinha: {shifts.length ? shifts.map((s) => `${s.opensAt}–${s.closesAt}`).join(" e ") : <strong>fechado</strong>}
        </p>

        {shifts.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-cream p-3">
            <label className="min-w-48 flex-1">
              <span className="text-sm font-semibold">Preencher o dia com</span>
              <select className="input mt-1" value={fillProduct} onChange={(e) => setFillProduct(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.batchSize} un / {p.batchDurationMin} min</option>)}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const p = byId.get(fillProduct);
                if (p) setRows(fillDay(p.id, p.batchDurationMin, shifts).map(({ productId, startTime }) => ({ productId, startTime })));
              }}
            >
              <Wand2 className="size-4" /> Preencher dia
            </button>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-ink/60">Nenhuma fornada neste dia: não aceita encomendas.</p>
        ) : (
          <ul className="space-y-2">
            {rows
              .map((r, i) => ({ r, i }))
              .sort((a, b) => minutesOf(a.r.startTime || "00:00") - minutesOf(b.r.startTime || "00:00"))
              .map(({ r, i }) => {
                const p = byId.get(r.productId);
                const end = p && r.startTime ? hhmmOf(minutesOf(r.startTime) + p.batchDurationMin) : "";
                return (
                  <li key={i} className={`flex flex-wrap items-center gap-2 rounded-2xl p-2 ring-1 ${errors[i] ? "bg-tomato/5 ring-tomato" : "ring-terracotta/10"}`}>
                    <TimeSelect
                      className="w-28"
                      value={r.startTime}
                      onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, startTime: v } : x)))}
                      aria-label="Início"
                    />
                    <select
                      className="input min-w-40 flex-1"
                      value={r.productId}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}
                      aria-label="Receita"
                    >
                      {products.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
                    </select>
                    <span className="text-sm text-ink/70">→ pronto {end} · {p?.batchSize} un</span>
                    {errors[i] && <span className="text-sm font-semibold text-tomato">{errors[i]}</span>}
                    <button type="button" className="ml-auto text-ink/40 hover:text-tomato" aria-label="Remover fornada" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={products.length === 0}
            onClick={() => {
              const last = [...rows].sort((a, b) => minutesOf(b.startTime) - minutesOf(a.startTime))[0];
              const lastP = last ? byId.get(last.productId) : undefined;
              const start = last && lastP ? hhmmOf(minutesOf(last.startTime) + lastP.batchDurationMin) : shifts[0]?.opensAt ?? "08:00";
              setRows([...rows, { productId: last?.productId ?? products[0].id, startTime: start }]);
            }}
          >
            <Plus className="size-4" /> Adicionar fornada
          </button>
          {rows.length > 0 && <button type="button" className="btn-ghost text-ink/60" onClick={() => setRows([])}>Limpar dia</button>}
          <button type="button" className="btn-primary ml-auto" onClick={save} disabled={pending}>
            {pending ? "Salvando…" : `Salvar ${WEEKDAYS_PT[weekday].toLowerCase()}`}
          </button>
        </div>
        {message && (
          <p className={`text-sm font-semibold ${message.kind === "ok" ? "text-emerald-700" : "text-tomato"}`} role="status">{message.text}</p>
        )}
      </section>
    </div>
  );
}
