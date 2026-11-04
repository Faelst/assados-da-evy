import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { getStore } from "@/server/store";
import { ensureBatches, listDayBatches, releaseExpiredHolds } from "@/server/services/batches";
import { isBookable } from "@/server/domain/allocation";
import { addDays, todayIn, utcToLocalHHmm, weekdayOf, WEEKDAYS_PT } from "@/server/domain/time";
import { ScheduledOrder } from "@/components/loja/ScheduledOrder";

export default async function DiaEncomenda({ params }: PageProps<"/encomendar/[data]">) {
  const { data } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) notFound();
  const store = await getStore();
  const today = todayIn(store.timezone);
  if (data < today || data > addDays(today, store.bookingWindowDays)) notFound();

  const now = new Date();
  await releaseExpiredHolds(now);
  await ensureBatches(store.id, data, data);
  const batches = await listDayBatches(store.id, data);
  const products = await db.product.findMany({
    where: { storeId: store.id, active: true, id: { in: [...new Set(batches.map((b) => b.productId))] } },
    include: { variants: true },
    orderBy: { sortOrder: "asc" },
  });

  const [y, m, d] = data.split("-");
  const title = `${WEEKDAYS_PT[weekdayOf(data)]}, ${d}/${m}/${y}`;

  return (
    <div className="space-y-6">
      <Link href="/encomendar" className="btn-ghost -ml-3">
        <ArrowLeft className="size-4" /> Outras datas
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold text-terracotta-dark">{title}</h1>
        <p className="text-ink/70">Receitas da fornada deste dia. Escolha as quantidades e depois o horário.</p>
      </div>

      {products.length === 0 && <p className="card text-center text-ink/70">Não há fornadas nesta data.</p>}

      <ScheduledOrder
        date={data}
        products={products.map((p) => {
          const own = batches.filter((b) => b.productId === p.id);
          const bookable = own.filter((b) => isBookable(b, now, p.leadTimeHours));
          const free = Math.floor(bookable.reduce((s, b) => s + b.freeUnits, 0) / p.productionUnits);
          const times = own.map((b) => utcToLocalHHmm(b.readyAt, store.timezone)).join(" · ");
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            priceCents: p.priceCents,
            imageUrl: p.imageUrl,
            free,
            badge:
              `Fica pronto: ${times}` +
              (free > 0 ? ` · ${free} disponíveis` : "") +
              (p.leadTimeHours > 0 ? ` · pedir com ${p.leadTimeHours}h de antecedência` : ""),
            variants: p.variants.map((v) => ({ id: v.id, name: v.name, priceDeltaCents: v.priceDeltaCents })),
          };
        })}
      />
    </div>
  );
}
