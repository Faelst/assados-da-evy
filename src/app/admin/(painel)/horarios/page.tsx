import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { HoursEditor } from "@/components/admin/HoursEditor";

export default async function Horarios() {
  await requireSection("horarios");
  const store = await getStore();
  const hours = await db.businessHour.findMany({ where: { storeId: store.id }, orderBy: { opensAt: "asc" } });
  return (
    <>
      <PageHeader title="Horário da cozinha" subtitle="Turnos de cada dia da semana. Dia sem turno = fechado. Feriados ficam em Feriados e exceções." />
      <HoursEditor initial={hours.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt }))} />
    </>
  );
}
