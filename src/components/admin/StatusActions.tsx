"use client";

import { useActionState, useState } from "react";
import { changeStatusAction } from "@/app/admin/(painel)/pedidos/actions";

export function StatusActions({ orderId, next }: { orderId: string; next: { status: string; label: string }[] }) {
  const [state, action, pending] = useActionState(changeStatusAction, undefined);
  const [cancelling, setCancelling] = useState(false);
  const forward = next.filter((n) => n.status !== "CANCELLED");
  const canCancel = next.some((n) => n.status === "CANCELLED");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {forward.map((n) => (
          <form key={n.status} action={action}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="to" value={n.status} />
            <button className="btn-primary" disabled={pending}>{n.label}</button>
          </form>
        ))}
        {canCancel && !cancelling && (
          <button type="button" className="btn-secondary text-tomato" onClick={() => setCancelling(true)}>Cancelar pedido</button>
        )}
      </div>
      {cancelling && (
        <form action={action} className="space-y-2 rounded-2xl bg-tomato/5 p-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="to" value="CANCELLED" />
          <label className="block text-sm font-semibold">
            Motivo do cancelamento
            <input name="reason" required className="input mt-1" placeholder="Ex.: cliente desistiu" />
          </label>
          <div className="flex gap-2">
            <button className="btn-primary bg-tomato hover:bg-tomato/90" disabled={pending}>Confirmar cancelamento</button>
            <button type="button" className="btn-ghost" onClick={() => setCancelling(false)}>Voltar</button>
          </div>
        </form>
      )}
      {state?.error && <p className="text-sm font-semibold text-tomato" role="alert">{state.error}</p>}
    </div>
  );
}
