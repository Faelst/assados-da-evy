"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="text-sm font-semibold">E-mail</span>
        <input name="email" type="email" required autoComplete="username" className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Senha</span>
        <input name="password" type="password" required autoComplete="current-password" className="input mt-1" />
      </label>
      {state?.error && <p className="text-sm font-semibold text-tomato" role="alert">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
