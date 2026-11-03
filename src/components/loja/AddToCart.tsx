"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { useCart, type CartItem } from "./cart";
import { QtyStepper } from "./QtyStepper";

export function AddToCart({
  type,
  item,
  date,
  disabled,
  label = "Adicionar",
  variants = [],
}: {
  type: "READY" | "SCHEDULED";
  item: Omit<CartItem, "qty">;
  date?: string;
  disabled?: boolean;
  label?: string;
  variants?: { id: string; name: string; priceDeltaCents: number }[];
}) {
  const { add, replace, cart } = useCart();
  const router = useRouter();
  const inCart = cart.items.filter((i) => i.productId === item.productId).reduce((sum, i) => sum + i.qty, 0);
  const max = item.max !== undefined ? Math.max(0, item.max - inCart) : undefined;
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [variantId, setVariantId] = useState(variants[0]?.id);
  const variant = variants.find((v) => v.id === variantId);

  function submit(force = false) {
    const line = variant
      ? { ...item, qty, variantId: variant.id, name: `${item.name} (${variant.name})`, priceCents: item.priceCents + variant.priceDeltaCents }
      : { ...item, qty };
    if (force) replace(type, line, date);
    else if (!add(type, line, date)) {
      setConflict(true);
      return;
    }
    setConflict(false);
    setDone(true);
    setQty(1);
    setTimeout(() => setDone(false), 1500);
    router.prefetch("/carrinho");
  }

  if (disabled || max === 0) {
    return (
      <span className="chip bg-ink/10 text-ink/60">{max === 0 && !disabled ? "Tudo no seu carrinho" : "Esgotado"}</span>
    );
  }

  if (conflict) {
    return (
      <div className="rounded-2xl bg-amber/20 p-3 text-sm" role="alert">
        <p className="font-semibold">
          {cart.type !== type
            ? "Pronta entrega e encomenda são pedidos separados. Esvaziar o carrinho e adicionar este item?"
            : "Seu carrinho tem uma encomenda para outra data. Esvaziar e adicionar este item?"}
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-primary px-4 py-1.5 text-sm" onClick={() => submit(true)}>Esvaziar e adicionar</button>
          <button type="button" className="btn-ghost" onClick={() => setConflict(false)}>Manter carrinho</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {variants.length > 0 && (
        <select className="input w-auto py-1.5 text-sm" value={variantId} onChange={(e) => setVariantId(e.target.value)} aria-label="Variação">
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.priceDeltaCents ? ` (+${(v.priceDeltaCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})` : ""}
            </option>
          ))}
        </select>
      )}
      <QtyStepper value={qty} onChange={setQty} min={1} max={max} />
      <button type="button" onClick={() => submit()} className="btn-primary px-4 py-2 text-sm">
        {done ? <Check className="size-4" /> : <Plus className="size-4" />} {done ? "Adicionado" : label}
      </button>
    </div>
  );
}
