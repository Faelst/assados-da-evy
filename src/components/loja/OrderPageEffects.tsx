"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart";

/** Limpa o carrinho quando o pedido acabou de ser criado e atualiza o status periodicamente. */
export function OrderPageEffects({ isNew, live }: { isNew: boolean; live: boolean }) {
  const { clear, ready } = useCart();
  const router = useRouter();
  useEffect(() => {
    if (isNew && ready) clear();
  }, [isNew, ready, clear]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [live, router]);
  return null;
}
