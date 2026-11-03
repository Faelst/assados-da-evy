import { Clock, Route } from "lucide-react";
import type { FeeBreakdown } from "@/server/domain/delivery-pricing";
import { formatCents } from "@/lib/phone";

/** Detalhamento do frete no estilo app de corrida. */
export function DeliveryBreakdown({ b }: { b: FeeBreakdown }) {
  const rows: [string, number][] = [
    ["Tarifa base", b.baseCents],
    [`Distância (${b.distanceKm.toLocaleString("pt-BR")} km)`, b.distanceCents],
    [`Tempo (${b.durationMin} min)`, b.timeCents],
  ];
  if (b.surgeCents) rows.push([`Horário de pico (${b.surgeMultiplier.toLocaleString("pt-BR")}×)`, b.surgeCents]);
  if (b.minimumAdjustCents) rows.push(["Ajuste para tarifa mínima", b.minimumAdjustCents]);
  if (b.serviceFeeCents) rows.push(["Taxa de serviço", b.serviceFeeCents]);
  return (
    <div className="rounded-2xl bg-cream p-3 text-sm">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold">
        <span className="flex items-center gap-1"><Route className="size-4 text-terracotta" /> {b.distanceKm.toLocaleString("pt-BR")} km</span>
        <span className="flex items-center gap-1"><Clock className="size-4 text-terracotta" /> ~{b.durationMin} min de rota</span>
      </div>
      <ul className="space-y-0.5">
        {rows.map(([label, v]) => (
          <li key={label} className="flex justify-between text-ink/70"><span>{label}</span><span className="tabular-nums">{formatCents(v)}</span></li>
        ))}
        <li className="flex justify-between border-t border-terracotta/10 pt-1 font-bold text-terracotta">
          <span>Frete</span><span className="tabular-nums">{formatCents(b.totalCents)}</span>
        </li>
      </ul>
    </div>
  );
}
