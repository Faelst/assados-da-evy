"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart";

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/carrinho"
      className="relative inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-bold text-cream transition hover:bg-terracotta-dark"
      aria-label={`Carrinho com ${count} itens`}
    >
      <ShoppingBag className="size-4" />
      <span className="hidden sm:inline">Carrinho</span>
      {ready && count > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-amber px-1 text-xs text-ink">{count}</span>
      )}
    </Link>
  );
}
