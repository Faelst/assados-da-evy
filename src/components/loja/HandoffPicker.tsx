"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useCart } from "./cart";

type Slot = { at: string; label: string; available: boolean };

export function HandoffPicker({ date }: { date: string }) {
  const { cart, setHandoff, ready } = useCart();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const active = ready && cart.type === "SCHEDULED" && cart.date === date && cart.items.length > 0;
  const key = active ? JSON.stringify(cart.items.map((i) => [i.productId, i.qty])) : "";

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/loja/horarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, items: JSON.parse(key).map(([productId, qty]: [string, number]) => ({ productId, qty })) }),
    })
      .then((r) => r.json())
      .then((data: Slot[]) => !cancelled && setSlots(data))
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [active, key, date]);

  if (!active) return null;

  return (
    <section className="card sticky bottom-3 z-30 space-y-3 shadow-xl">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-terracotta-dark">
        <Clock className="size-5" /> Horário de retirada ou entrega
      </h2>
      {slots === null ? (
        <p className="text-sm text-ink/60">Calculando horários…</p>
      ) : slots.filter((s) => s.available).length === 0 ? (
        <p className="text-sm font-semibold text-tomato">Não há fornada com vaga para essa quantidade. Diminua os itens ou escolha outra data.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => {
            const selected = cart.handoffAt === s.at;
            return (
              <button
                key={s.at}
                type="button"
                disabled={!s.available}
                onClick={() => setHandoff(s.at, s.label)}
                aria-pressed={selected}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  selected
                    ? "bg-terracotta text-cream"
                    : s.available
                      ? "bg-cream text-terracotta ring-1 ring-terracotta/30 hover:bg-terracotta/10"
                      : "cursor-not-allowed bg-ink/5 text-ink/30 line-through"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
      <Link
        href={cart.handoffAt ? "/checkout" : "#"}
        aria-disabled={!cart.handoffAt}
        className={`btn-primary w-full ${cart.handoffAt ? "" : "pointer-events-none opacity-50"}`}
      >
        {cart.handoffAt ? `Continuar · pronto às ${cart.handoffLabel}` : "Escolha um horário"}
      </Link>
    </section>
  );
}
