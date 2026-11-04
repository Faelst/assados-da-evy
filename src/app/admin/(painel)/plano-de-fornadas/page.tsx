import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { PlanEditor } from "@/components/admin/PlanEditor";
import { ProductionTabs } from "@/components/admin/ProductionTabs";
import { todayIn } from "@/server/domain/time";

export default async function PlanoDeFornadas({ searchParams }: PageProps<"/admin/plano-de-fornadas">) {
  const session = await requireSection("plano-de-fornadas");
  const store = await getStore();
  const sp = await searchParams;
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : todayIn(store.timezone);
  const dia = Number(sp.dia);
  const initialWeekday = Number.isInteger(dia) && dia >= 0 && dia <= 6 ? dia : undefined;
  const [products, hours, plan] = await Promise.all([
    db.product.findMany({
      where: { storeId: store.id, active: true, saleModes: { has: "SCHEDULED" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, batchSize: true, batchDurationMin: true },
    }),
    db.businessHour.findMany({ where: { storeId: store.id }, orderBy: { opensAt: "asc" } }),
    db.weeklyBatchPlan.findMany({ where: { storeId: store.id }, orderBy: { startTime: "asc" } }),
  ]);
  return (
    <>
      <ProductionTabs active="plano" date={date} role={session.role} />
      <PageHeader
        title="Plano semanal de fornadas"
        subtitle={`Monte cada dia da semana: qual receita entra no forno e a que horas. A cozinha faz ${store.parallelBatches} fornada(s) ao mesmo tempo (mude em Configurações).`}
      />
      <PlanEditor
        products={products}
        hours={hours.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt }))}
        plan={plan.map((p) => ({ weekday: p.weekday, productId: p.productId, startTime: p.startTime }))}
        initialWeekday={initialWeekday}
      />
    </>
  );
}
