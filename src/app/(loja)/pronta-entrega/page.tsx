import Link from "next/link";
import { getStore } from "@/server/store";
import { getTodayMenu } from "@/server/services/stock";
import { ProductCard } from "@/components/loja/ProductCard";
import { AddToCart } from "@/components/loja/AddToCart";

export const metadata = { title: "Pronta entrega — Assados da Evy" };

export default async function ProntaEntrega() {
  const store = await getStore();
  const menu = await getTodayMenu(store.id);

  if (!menu || !menu.open) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl font-bold text-terracotta-dark">Pronta entrega indisponível agora</h1>
        <p className="mt-2 text-ink/70">
          {menu ? "A cozinha está fechada neste momento." : "Ainda não montamos o cardápio de hoje."} Você pode encomendar para outro dia.
        </p>
        <Link href="/encomendar" className="btn-primary mt-5">Encomendar</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-terracotta-dark">Pronta entrega</h1>
        <p className="text-ink/70">Saiu do forno hoje. Retirada ou entrega em até {store.readyEtaMinutes} minutos.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {menu.items.map((i) => {
          const soldOut = i.qtyAvailable <= 0 || i.paused;
          return (
            <ProductCard
              key={i.itemId}
              name={i.name}
              description={i.description}
              priceCents={i.priceCents}
              imageUrl={i.imageUrl}
              badge={
                soldOut ? (
                  <span className="chip self-start bg-ink/10 text-ink/60">Esgotado</span>
                ) : i.qtyAvailable <= 3 ? (
                  <span className="chip self-start bg-tomato/15 text-tomato">Últimas {i.qtyAvailable} unidades</span>
                ) : null
              }
            >
              <AddToCart
                type="READY"
                disabled={soldOut}
                item={{ productId: i.productId, name: i.name, priceCents: i.priceCents, imageUrl: i.imageUrl, max: i.qtyAvailable }}
              />
            </ProductCard>
          );
        })}
      </div>
    </div>
  );
}
