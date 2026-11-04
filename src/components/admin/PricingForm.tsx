"use client";

import { useActionState, useState } from "react";
import { savePricingAction } from "@/app/admin/(painel)/entrega/actions";
import { quoteFee } from "@/server/domain/delivery-pricing";
import { formatCents } from "@/lib/phone";
import { DeliveryBreakdown } from "@/components/loja/DeliveryBreakdown";
import { TimeSelect } from "./TimeSelect";

export type PricingInitial = {
  deliveryPricing: "ZONES" | "DISTANCE";
  originAddress: string;
  originLat: number | null;
  originLng: number | null;
  base: number;
  perKm: number;
  perMinute: number;
  minFee: number;
  serviceFee: number;
  maxKm: number;
  surgeMultiplier: number;
  surgeStart: string | null;
  surgeEnd: string | null;
};

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const toCents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100) || 0;

function Money({ name, label, value, onChange, hint }: { name: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label>
      <span className="text-sm font-semibold">{label}</span>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/50">R$</span>
        <input name={name} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="input pl-9" />
      </div>
      {hint && <span className="text-xs text-ink/55">{hint}</span>}
    </label>
  );
}

export function PricingForm({ initial }: { initial: PricingInitial }) {
  const [state, action, pending] = useActionState(savePricingAction, undefined);
  const [mode, setMode] = useState(initial.deliveryPricing);
  const [v, setV] = useState({
    base: reais(initial.base),
    perKm: reais(initial.perKm),
    perMinute: reais(initial.perMinute),
    minFee: reais(initial.minFee),
    serviceFee: reais(initial.serviceFee),
    maxKm: String(initial.maxKm).replace(".", ","),
    surge: String(initial.surgeMultiplier).replace(".", ","),
  });
  const [surgeStart, setSurgeStart] = useState(initial.surgeStart ?? "");
  const [surgeEnd, setSurgeEnd] = useState(initial.surgeEnd ?? "");
  const [sim, setSim] = useState({ km: "5", min: "15", time: "12:00" });
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));

  const simQuote = quoteFee(
    { distanceKm: Number(sim.km.replace(",", ".")) || 0, durationMin: Number(sim.min) || 0 },
    {
      baseCents: toCents(v.base),
      perKmCents: toCents(v.perKm),
      perMinuteCents: toCents(v.perMinute),
      minFeeCents: toCents(v.minFee),
      serviceFeeCents: toCents(v.serviceFee),
      maxKm: Number(v.maxKm.replace(",", ".")) || 0,
      surgeMultiplier: Number(v.surge.replace(",", ".")) || 1,
      surgeStart: surgeStart || null,
      surgeEnd: surgeEnd || null,
    },
    sim.time,
  );

  return (
    <form action={action} className="card space-y-4">
      <h2 className="font-display text-lg font-bold">Como cobrar a entrega</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          ["DISTANCE", "Por distância e tempo", "Como app de corrida: tarifa base + km + minutos de rota, com mínima, taxa de serviço e pico."],
          ["ZONES", "Por bairro", "Valor fixo para cada bairro da lista abaixo."],
        ] as const).map(([id, title, desc]) => (
          <label key={id} className={`flex cursor-pointer gap-3 rounded-2xl p-3 ring-1 ${mode === id ? "bg-terracotta/5 ring-terracotta" : "ring-terracotta/15"}`}>
            <input type="radio" name="deliveryPricing" value={id} checked={mode === id} onChange={() => setMode(id)} className="mt-1 accent-terracotta" />
            <span><span className="block font-bold">{title}</span><span className="text-sm text-ink/60">{desc}</span></span>
          </label>
        ))}
      </div>

      <div className={mode === "DISTANCE" ? "space-y-4" : "hidden"}>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">Endereço de saída (cozinha)</span>
            <input name="originAddress" defaultValue={initial.originAddress} className="input mt-1" placeholder="Rua, número, bairro, cidade - UF" />
          </label>
          <label>
            <span className="text-sm font-semibold">Latitude</span>
            <input name="originLat" defaultValue={initial.originLat ?? ""} className="input mt-1" inputMode="decimal" />
          </label>
          <label>
            <span className="text-sm font-semibold">Longitude</span>
            <input name="originLng" defaultValue={initial.originLng ?? ""} className="input mt-1" inputMode="decimal" />
          </label>
          <p className="text-xs text-ink/55 sm:col-span-4">
            Ao mudar o endereço, a posição é localizada no mapa (OpenStreetMap). Se ficar imprecisa, cole a latitude e a longitude do Google Maps.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Money name="base" label="Tarifa base" value={v.base} onChange={set("base")} />
          <Money name="perKm" label="Preço por km" value={v.perKm} onChange={set("perKm")} />
          <Money name="perMinute" label="Preço por minuto" value={v.perMinute} onChange={set("perMinute")} />
          <Money name="minFee" label="Tarifa mínima" value={v.minFee} onChange={set("minFee")} hint="Corrida nunca sai por menos (sem contar a taxa de serviço)." />
          <Money name="serviceFee" label="Taxa de serviço" value={v.serviceFee} onChange={set("serviceFee")} hint="Valor fixo somado a toda entrega." />
          <label>
            <span className="text-sm font-semibold">Raio máximo (km)</span>
            <input name="deliveryMaxKm" inputMode="decimal" value={v.maxKm} onChange={(e) => set("maxKm")(e.target.value)} className="input mt-1" />
          </label>
        </div>

        <div className="grid gap-3 rounded-2xl bg-cream p-3 sm:grid-cols-3">
          <label>
            <span className="text-sm font-semibold">Pico: multiplicador</span>
            <input name="surgeMultiplier" inputMode="decimal" value={v.surge} onChange={(e) => set("surge")(e.target.value)} className="input mt-1" />
            <span className="text-xs text-ink/55">1 = sem pico. Ex.: 1,3 = 30% a mais.</span>
          </label>
          <label>
            <span className="text-sm font-semibold">Pico começa</span>
            <TimeSelect name="surgeStart" value={surgeStart} onChange={setSurgeStart} optional className="mt-1" />
          </label>
          <label>
            <span className="text-sm font-semibold">Pico termina</span>
            <TimeSelect name="surgeEnd" value={surgeEnd} onChange={setSurgeEnd} optional className="mt-1" />
          </label>
        </div>

        <div className="rounded-2xl p-3 ring-1 ring-terracotta/15">
          <p className="mb-2 text-sm font-bold">Simulador</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <label className="text-sm">km <input className="input mt-1 w-20 py-1.5" inputMode="decimal" value={sim.km} onChange={(e) => setSim({ ...sim, km: e.target.value })} /></label>
            <label className="text-sm">min <input className="input mt-1 w-20 py-1.5" inputMode="numeric" value={sim.min} onChange={(e) => setSim({ ...sim, min: e.target.value })} /></label>
            <label className="text-sm">horário <TimeSelect className="mt-1 w-24 py-1.5" value={sim.time} onChange={(t) => setSim({ ...sim, time: t })} /></label>
          </div>
          {simQuote.ok ? (
            <DeliveryBreakdown b={simQuote.breakdown} />
          ) : (
            <p className="text-sm font-semibold text-tomato">Fora do raio máximo: não entrega.</p>
          )}
          {simQuote.ok && <p className="mt-1 text-xs text-ink/55">O cliente vê exatamente esse detalhamento no checkout: {formatCents(simQuote.breakdown.totalCents)}.</p>}
        </div>
      </div>

      {mode === "ZONES" && <p className="text-sm text-ink/60">Cadastre os bairros e as taxas na lista abaixo.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar frete"}</button>
        {state?.error && <p className="text-sm font-semibold text-tomato" role="alert">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-emerald-700" role="status">{state.ok}</p>}
      </div>
    </form>
  );
}
