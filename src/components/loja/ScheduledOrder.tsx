"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ShoppingBag } from "lucide-react";
import { formatCents } from "@/lib/phone";
import { useCart, type CartItem } from "./cart";
import { ProductCard } from "./ProductCard";
import { QtyStepper } from "./QtyStepper";

type Variant = { id: string; name: string; priceDeltaCents: number };
export type ScheduledProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  badge: string;
  /** Unidades ainda disponíveis no dia (somando as variações). */
  free: number;
  variants: Variant[];
};
type Slot = { at: string; label: string; available: boolean };

const lineKey = (productId: string, variantId?: string) => `${productId}:${variantId ?? ""}`;

/**
 * Encomenda de um dia: a cliente escolhe as quantidades e o horário aqui na tela;
 * só no fim tudo vai para o carrinho (já com o horário) e segue para o checkout.
 */
export function ScheduledOrder({ date, products }: { date: string; products: ScheduledProduct[] }) {
  const { cart, ready, load } = useCart();
  const router = useRouter();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [handoff, setHandoff] = useState<{ at: string; label: string } | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const seeded = useRef(false);

  // Se já existe uma encomenda deste dia no carrinho, começa a tela a partir dela.
  useEffect(() => {
    if (!ready || seeded.current) return;
    seeded.current = true;
    if (cart.type !== "SCHEDULED" || cart.date !== date || cart.items.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- semente única a partir do carrinho salvo
    setQtys(Object.fromEntries(cart.items.map((i) => [lineKey(i.productId, i.variantId), i.qty])));
    if (cart.handoffAt && cart.handoffLabel) setHandoff({ at: cart.handoffAt, label: cart.handoffLabel });
  }, [ready, cart, date]);

  const lines = useMemo(() => {
    const out: CartItem[] = [];
    for (const p of products) {
      const options = p.variants.length ? p.variants : [undefined];
      for (const v of options) {
        const qty = qtys[lineKey(p.id, v?.id)] ?? 0;
        if (qty <= 0) continue;
        out.push({
          productId: p.id,
          variantId: v?.id,
          name: v ? `${p.name} (${v.name})` : p.name,
          priceCents: p.priceCents + (v?.priceDeltaCents ?? 0),
          imageUrl: p.imageUrl,
          qty,
        });
      }
    }
    return out;
  }, [products, qtys]);

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.priceCents, 0);
  // Os horários dependem só do total por receita (variações dividem a mesma fornada).
  const perProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
    return [...m].map(([productId, qty]) => ({ productId, qty }));
  }, [lines]);
  const slotsKey = JSON.stringify(perProduct);

  useEffect(() => {
    if (perProduct.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nada escolhido, nada a calcular
      setSlots(null);
      return;
    }
    setSlots(null);
    let cancelled = false;
    const t = setTimeout(() => {
      fetch("/api/loja/horarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, items: JSON.parse(slotsKey) }),
      })
        .then((r) => r.json())
        .then((data: Slot[]) => {
          if (cancelled) return;
          setSlots(data);
          // Mantém o horário escolhido só se ele ainda comporta as novas quantidades.
          setHandoff((h) => (h && data.some((s) => s.at === h.at && s.available) ? h : null));
        })
        .catch(() => !cancelled && setSlots([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slotsKey resume perProduct
  }, [slotsKey, date]);

  function setLine(productId: string, variantId: string | undefined, qty: number) {
    setQtys((q) => ({ ...q, [lineKey(productId, variantId)]: qty }));
  }

  const replacesCart =
    ready && cart.items.length > 0 && (cart.type !== "SCHEDULED" || cart.date !== date);

  function finish() {
    if (!handoff || lines.length === 0) return;
    load({ type: "SCHEDULED", date, handoffAt: handoff.at, handoffLabel: handoff.label, items: lines });
    router.push("/checkout");
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {products.map((p) => {
          const totalForProduct = (p.variants.length ? p.variants.map((v) => v.id) : [undefined]).reduce(
            (s, vid) => s + (qtys[lineKey(p.id, vid)] ?? 0),
            0,
          );
          return (
            <ProductCard
              key={p.id}
              name={p.name}
              description={p.description}
              priceCents={p.priceCents}
              imageUrl={p.imageUrl}
              badge={<span className="text-xs font-semibold text-ink/60">{p.badge}</span>}
            >
              {p.free <= 0 ? (
                <span className="chip bg-ink/10 text-ink/60">Esgotado</span>
              ) : p.variants.length === 0 ? (
                <QtyStepper value={qtys[lineKey(p.id)] ?? 0} onChange={(n) => setLine(p.id, undefined, n)} max={p.free} />
              ) : (
                <div className="space-y-2">
                  {p.variants.map((v) => {
                    const own = qtys[lineKey(p.id, v.id)] ?? 0;
                    return (
                      <div key={v.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {v.name}
                          {v.priceDeltaCents ? <span className="text-ink/60"> (+{formatCents(v.priceDeltaCents)})</span> : null}
                        </span>
                        <QtyStepper value={own} onChange={(n) => setLine(p.id, v.id, n)} max={p.free - totalForProduct + own} />
                      </div>
                    );
                  })}
                </div>
              )}
            </ProductCard>
          );
        })}
      </div>

      {count > 0 && (
        <section className="card sticky bottom-3 z-30 space-y-3 shadow-xl">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-terracotta-dark">
            <Clock className="size-5" /> Horário de retirada ou entrega
          </h2>
          {slots === null ? (
            <p className="text-sm text-ink/60">Calculando horários…</p>
          ) : slots.filter((s) => s.available).length === 0 ? (
            <p className="text-sm font-semibold text-tomato">
              Não há fornada com vaga para essa quantidade. Diminua os itens ou escolha outra data.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => {
                const selected = handoff?.at === s.at;
                return (
                  <button
                    key={s.at}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setHandoff({ at: s.at, label: s.label })}
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
          {replacesCart && (
            <p className="text-xs font-semibold text-ink/70">
              {cart.type === "READY"
                ? "Seu carrinho tem itens de pronta entrega; eles serão trocados por esta encomenda."
                : "Seu carrinho tem uma encomenda de outra data; ela será trocada por esta."}
            </p>
          )}
          <button type="button" onClick={finish} disabled={!handoff} className="btn-primary w-full disabled:opacity-50">
            <ShoppingBag className="size-4" />
            {handoff
              ? `Adicionar ao carrinho e finalizar · ${formatCents(subtotal)}`
              : "Escolha um horário"}
          </button>
        </section>
      )}
    </>
  );
}
