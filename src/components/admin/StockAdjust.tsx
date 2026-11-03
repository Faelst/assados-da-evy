"use client";

import { useActionState, useState } from "react";
import { adjustAction } from "@/app/admin/(painel)/cardapio-do-dia/actions";

export function StockAdjust({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(adjustAction, undefined);
  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>Ajustar estoque</button>;
  return (
    <form action={action} className="flex w-full flex-wrap items-end gap-2 rounded-2xl bg-cream p-2">
      <input type="hidden" name="itemId" value={itemId} />
      <select name="type" className="input w-36 py-1.5">
        <option value="IN">Entrada (fornada nova)</option>
        <option value="OUT">Saída</option>
        <option value="LOSS">Perda</option>
      </select>
      <input type="number" name="qty" min={1} required placeholder="Qtd" className="input w-20 py-1.5" />
      <input name="reason" required placeholder="Motivo" className="input min-w-32 flex-1 py-1.5" />
      <button className="btn-primary px-4 py-1.5 text-sm" disabled={pending}>Lançar</button>
      <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Fechar</button>
      {state?.error && <p className="w-full text-sm font-semibold text-tomato">{state.error}</p>}
    </form>
  );
}
