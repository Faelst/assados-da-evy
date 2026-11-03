"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatCents } from "@/lib/phone";
import { useCart } from "./cart";
import { QtyStepper } from "./QtyStepper";

function formatDate(d?: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function CartView() {
  const { cart, ready, setQty, clear, subtotalCents } = useCart();
  if (!ready) return <p className="py-20 text-center text-ink/60">Carregando…</p>;

  if (cart.items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl font-bold text-terracotta-dark">Seu carrinho está vazio</h1>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/pronta-entrega" className="btn-secondary">Pronta entrega</Link>
          <Link href="/encomendar" className="btn-primary">Encomendar</Link>
        </div>
      </div>
    );
  }

  const scheduled = cart.type === "SCHEDULED";
  const nextHref = scheduled ? (cart.handoffAt ? "/checkout" : `/encomendar/${cart.date}`) : "/checkout";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-3xl font-bold text-terracotta-dark">Carrinho</h1>
      <p className="chip bg-terracotta/10 text-terracotta">
        {scheduled
          ? `Encomenda para ${formatDate(cart.date)}${cart.handoffLabel ? ` · pronto às ${cart.handoffLabel}` : " · horário a escolher"}`
          : "Pronta entrega · hoje"}
      </p>
      <ul className="card divide-y divide-terracotta/10 p-0">
        {cart.items.map((i) => (
          <li key={`${i.productId}-${i.variantId ?? ""}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-bold">{i.name}</p>
              <p className="text-sm text-ink/60">{formatCents(i.priceCents)} cada</p>
            </div>
            <div className="flex items-center gap-3">
              <QtyStepper value={i.qty} onChange={(q) => setQty(i.productId, i.variantId, q)} max={i.max} />
              <span className="w-20 text-right font-bold tabular-nums">{formatCents(i.qty * i.priceCents)}</span>
              <button type="button" aria-label={`Remover ${i.name}`} className="text-ink/40 hover:text-tomato" onClick={() => setQty(i.productId, i.variantId, 0)}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between px-1 text-lg">
        <span className="font-semibold">Subtotal</span>
        <span className="font-display text-2xl font-bold text-terracotta">{formatCents(subtotalCents)}</span>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button type="button" onClick={clear} className="btn-ghost">Esvaziar carrinho</button>
        <Link href={nextHref} className="btn-primary">
          {scheduled && !cart.handoffAt ? "Escolher horário" : "Finalizar pedido"}
        </Link>
      </div>
    </div>
  );
}
