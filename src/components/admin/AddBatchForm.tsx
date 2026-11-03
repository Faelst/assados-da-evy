"use client";

import { TimeSelect } from "@/components/admin/TimeSelect";
import { useActionState } from "react";
import { addBatchAction } from "@/app/admin/(painel)/fornadas/actions";

export function AddBatchForm({ date, products }: { date: string; products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addBatchAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="date" value={date} />
      <label className="min-w-40 flex-1">
        <span className="text-sm font-semibold">Receita</span>
        <select name="productId" className="input mt-1">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>
        <span className="text-sm font-semibold">Início</span>
        <TimeSelect name="startTime" defaultValue="09:00" required className="mt-1 w-28" />
      </label>
      <button className="btn-primary" disabled={pending}>Adicionar fornada</button>
      {state?.error && <p className="w-full text-sm font-semibold text-tomato">{state.error}</p>}
    </form>
  );
}
