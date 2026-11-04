import { minutesOf } from "./time";

export type PricingConfig = {
  baseCents: number;
  perKmCents: number;
  perMinuteCents: number;
  minFeeCents: number;
  serviceFeeCents: number;
  maxKm: number;
  surgeMultiplier: number;
  surgeStart: string | null;
  surgeEnd: string | null;
};

export type Trip = { distanceKm: number; durationMin: number };

export type FeeBreakdown = {
  distanceKm: number;
  durationMin: number;
  baseCents: number;
  distanceCents: number;
  timeCents: number;
  surgeMultiplier: number;
  /** quanto o pico acrescentou à corrida */
  surgeCents: number;
  /** quanto foi somado para chegar à tarifa mínima */
  minimumAdjustCents: number;
  serviceFeeCents: number;
  totalCents: number;
};

export type FeeQuote = { ok: true; breakdown: FeeBreakdown } | { ok: false; reason: "TOO_FAR" };

function inSurge(cfg: PricingConfig, hhmm: string) {
  if (!cfg.surgeStart || !cfg.surgeEnd || cfg.surgeMultiplier <= 1) return false;
  const t = minutesOf(hhmm);
  return t >= minutesOf(cfg.surgeStart) && t < minutesOf(cfg.surgeEnd);
}

/**
 * Tarifa no estilo app de corrida:
 * (base + km × preço/km + minutos × preço/min) × pico, nunca abaixo da mínima, mais a taxa de serviço.
 */
export function quoteFee(trip: Trip, cfg: PricingConfig, localHHmm: string): FeeQuote {
  if (trip.distanceKm > cfg.maxKm) return { ok: false, reason: "TOO_FAR" };
  const baseCents = cfg.baseCents;
  const distanceCents = Math.round(trip.distanceKm * cfg.perKmCents);
  const timeCents = Math.round(trip.durationMin * cfg.perMinuteCents);
  const ride = baseCents + distanceCents + timeCents;
  const surgeMultiplier = inSurge(cfg, localHHmm) ? cfg.surgeMultiplier : 1;
  const surged = Math.round(ride * surgeMultiplier);
  const minimumAdjustCents = Math.max(0, cfg.minFeeCents - surged);
  const totalCents = surged + minimumAdjustCents + cfg.serviceFeeCents;
  return {
    ok: true,
    breakdown: {
      distanceKm: trip.distanceKm,
      durationMin: trip.durationMin,
      baseCents,
      distanceCents,
      timeCents,
      surgeMultiplier,
      surgeCents: surged - ride,
      minimumAdjustCents,
      serviceFeeCents: cfg.serviceFeeCents,
      totalCents,
    },
  };
}
