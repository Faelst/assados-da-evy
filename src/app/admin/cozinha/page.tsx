import { Suspense } from "react";
import { requireSection } from "@/server/auth";
import { kitchenBoard } from "@/server/services/kitchen";
import { KitchenScreen } from "@/components/admin/KitchenScreen";

export const metadata = { title: "Cozinha ao vivo — Assados da Evy", robots: { index: false } };

async function Board() {
  const s = await requireSection("cozinha");
  const board = await kitchenBoard(s.storeId);
  return <KitchenScreen initial={board} role={s.role} />;
}

export default function CozinhaPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <Board />
    </Suspense>
  );
}
