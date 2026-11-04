"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  variantId?: string;
  name: string;
  priceCents: number;
  qty: number;
  imageUrl?: string | null;
  /** Limite de estoque (pronta entrega). */
  max?: number;
  notes?: string;
};

export type Cart = {
  type: "READY" | "SCHEDULED" | null;
  date?: string;
  handoffAt?: string;
  handoffLabel?: string;
  items: CartItem[];
};

const EMPTY: Cart = { type: null, items: [] };
const CART_KEY = "evy:cart";
const SESSION_KEY = "evy:session";

type CartApi = {
  cart: Cart;
  ready: boolean;
  count: number;
  subtotalCents: number;
  sessionId: string;
  /** Adiciona; devolve false se o carrinho é de outro tipo/data (o chamador decide se limpa). */
  add: (type: "READY" | "SCHEDULED", item: CartItem, date?: string) => boolean;
  setQty: (productId: string, variantId: string | undefined, qty: number) => void;
  setHandoff: (at: string | undefined, label: string | undefined) => void;
  clear: () => void;
  replace: (type: "READY" | "SCHEDULED", item: CartItem, date?: string) => void;
  /** Troca o carrinho inteiro (encomenda montada com itens e horário de uma vez). */
  load: (cart: Cart) => void;
};

const CartContext = createContext<CartApi | null>(null);

const sameLine = (a: CartItem, productId: string, variantId?: string) => a.productId === productId && a.variantId === variantId;

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação do localStorage
      if (raw) setCart(JSON.parse(raw));
      let sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem(SESSION_KEY, sid);
      }
      setSessionId(sid);
    } catch {
      setSessionId(crypto.randomUUID());
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, ready]);

  const add = useCallback(
    (type: "READY" | "SCHEDULED", item: CartItem, date?: string) => {
      const conflict = cart.items.length > 0 && (cart.type !== type || (type === "SCHEDULED" && cart.date !== date));
      if (conflict) return false;
      setCart((c) => {
        const existing = c.items.find((i) => sameLine(i, item.productId, item.variantId));
        const items = existing
          ? c.items.map((i) =>
              sameLine(i, item.productId, item.variantId)
                ? { ...i, qty: Math.min(i.qty + item.qty, item.max ?? Infinity), max: item.max }
                : i,
            )
          : [...c.items, { ...item, qty: Math.min(item.qty, item.max ?? Infinity) }];
        return { type, date, items, handoffAt: undefined, handoffLabel: undefined };
      });
      return true;
    },
    [cart],
  );

  const replace = useCallback((type: "READY" | "SCHEDULED", item: CartItem, date?: string) => {
    setCart({ type, date, items: [{ ...item, qty: Math.min(item.qty, item.max ?? Infinity) }] });
  }, []);

  const setQty = useCallback((productId: string, variantId: string | undefined, qty: number) => {
    setCart((c) => {
      const items = c.items
        .map((i) => (sameLine(i, productId, variantId) ? { ...i, qty: Math.min(qty, i.max ?? Infinity) } : i))
        .filter((i) => i.qty > 0);
      return items.length ? { ...c, items, handoffAt: undefined, handoffLabel: undefined } : EMPTY;
    });
  }, []);

  const setHandoff = useCallback((at: string | undefined, label: string | undefined) => {
    setCart((c) => ({ ...c, handoffAt: at, handoffLabel: label }));
  }, []);

  const clear = useCallback(() => setCart(EMPTY), []);

  const load = useCallback((next: Cart) => setCart(next.items.length ? next : EMPTY), []);

  const value = useMemo<CartApi>(
    () => ({
      cart,
      ready,
      sessionId,
      count: cart.items.reduce((s, i) => s + i.qty, 0),
      subtotalCents: cart.items.reduce((s, i) => s + i.qty * i.priceCents, 0),
      add,
      setQty,
      setHandoff,
      clear,
      replace,
      load,
    }),
    [cart, ready, sessionId, add, setQty, setHandoff, clear, replace, load],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart fora do CartProvider");
  return ctx;
}
