import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { PlanEditor } from "@/components/admin/PlanEditor";

export default async function PlanoDeFornadas() {
  await requireSection("plano-de-fornadas");
  const store = await getStore();
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
      <PageHeader
        title="Plano de fornadas"
        subtitle={`Monte cada dia da semana: qual receita entra no forno e a que horas. A cozinha faz ${store.parallelBatches} fornada(s) ao mesmo tempo (mude em Configurações).`}
      />
      <PlanEditor
        products={products}
        hours={hours.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt }))}
        plan={plan.map((p) => ({ weekday: p.weekday, productId: p.productId, startTime: p.startTime }))}
      />
    </>
  );
}
