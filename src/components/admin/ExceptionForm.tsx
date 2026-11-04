"use client";

import { TimeSelect } from "@/components/admin/TimeSelect";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createExceptionAction } from "@/app/admin/(painel)/excecoes/actions";

export function ExceptionForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createExceptionAction, undefined);
  const [type, setType] = useState("CLOSED");
  const [rows, setRows] = useState(1);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className="text-sm font-semibold">Data</span>
          <input type="date" name="date" required className="input mt-1" />
        </label>
        <label>
          <span className="text-sm font-semibold">Tipo</span>
          <select name="type" className="input mt-1" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="CLOSED">Fechado</option>
            <option value="SPECIAL_HOURS">Horário especial</option>
            <option value="SPECIAL_MENU">Cardápio especial</option>
          </select>
        </label>
        {type !== "CLOSED" && (
          <>
            <label>
              <span className="text-sm font-semibold">Abre {type === "SPECIAL_MENU" && <span className="font-normal text-ink/50">(opcional)</span>}</span>
              <TimeSelect name="opensAt" optional required={type === "SPECIAL_HOURS"} className="mt-1" />
            </label>
            <label>
              <span className="text-sm font-semibold">Fecha</span>
              <TimeSelect name="closesAt" optional required={type === "SPECIAL_HOURS"} className="mt-1" />
            </label>
          </>
        )}
      </div>
      <label className="block">
        <span className="text-sm font-semibold">Observação</span>
        <input name="note" className="input mt-1" placeholder="Ex.: Natal" />
      </label>
      {type === "SPECIAL_MENU" && (
        <div className="space-y-2 rounded-2xl bg-cream p-3">
          <p className="text-sm font-semibold">Fornadas desse dia</p>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex gap-2">
              <TimeSelect name="planStart" defaultValue="09:00" className="w-28" required aria-label="Início" />
              <select name="planProduct" className="input flex-1">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setRows(rows + 1)}><Plus className="size-4" /> Fornada</button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>Salvar exceção</button>
        {state?.error && <p className="text-sm font-semibold text-tomato">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-emerald-700">{state.ok}</p>}
      </div>
    </form>
  );
}
