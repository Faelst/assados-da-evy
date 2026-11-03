"use client";

import { useActionState } from "react";
import { changePasswordAction, createUserAction, saveStoreAction } from "@/app/admin/(painel)/configuracoes/actions";

function Feedback({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error) return <p className="text-sm font-semibold text-tomato" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="text-sm font-semibold text-emerald-700" role="status">{state.ok}</p>;
  return null;
}

export function StoreForm({ store }: { store: { name: string; whatsapp: string; parallelBatches: number; bookingWindowDays: number; holdMinutes: number } }) {
  const [state, action, pending] = useActionState(saveStoreAction, undefined);
  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-2">
      <h2 className="font-display text-lg font-bold sm:col-span-2">Loja e cozinha</h2>
      <label><span className="text-sm font-semibold">Nome da loja</span><input name="name" defaultValue={store.name} className="input mt-1" /></label>
      <label><span className="text-sm font-semibold">WhatsApp (com DDD)</span><input name="whatsapp" defaultValue={store.whatsapp} className="input mt-1" /></label>
      <label>
        <span className="text-sm font-semibold">Fornadas ao mesmo tempo</span>
        <input type="number" name="parallelBatches" min={1} max={20} defaultValue={store.parallelBatches} className="input mt-1" />
        <span className="text-xs text-ink/60">1 = uma fornada ocupa a cozinha. Planos já salvos não são revalidados ao diminuir.</span>
      </label>
      <label>
        <span className="text-sm font-semibold">Agenda aberta até quantos dias à frente</span>
        <input type="number" name="bookingWindowDays" min={1} max={180} defaultValue={store.bookingWindowDays} className="input mt-1" />
      </label>
      <label>
        <span className="text-sm font-semibold">Minutos que o horário fica reservado no checkout</span>
        <input type="number" name="holdMinutes" min={2} max={60} defaultValue={store.holdMinutes} className="input mt-1" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>Salvar</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-5">
      <input name="name" placeholder="Nome" className="input" required />
      <input name="email" type="email" placeholder="E-mail" className="input" required />
      <input name="password" type="password" placeholder="Senha (8+)" className="input" required minLength={8} />
      <select name="role" className="input" defaultValue="ATTENDANT">
        <option value="OWNER">Dono</option>
        <option value="ATTENDANT">Atendente</option>
        <option value="KITCHEN">Cozinha</option>
      </select>
      <button className="btn-secondary" disabled={pending}>Criar usuário</button>
      <div className="sm:col-span-5"><Feedback state={state} /></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="password" type="password" placeholder="Nova senha" className="input max-w-xs" minLength={8} required />
      <button className="btn-secondary" disabled={pending}>Trocar minha senha</button>
      <Feedback state={state} />
    </form>
  );
}
