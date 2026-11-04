import { describe, it, expect } from "vitest";
import { quoteFee, type PricingConfig } from "@/server/domain/delivery-pricing";

const cfg: PricingConfig = {
  baseCents: 500,
  perKmCents: 150,
  perMinuteCents: 30,
  minFeeCents: 700,
  serviceFeeCents: 100,
  maxKm: 15,
  surgeMultiplier: 1.5,
  surgeStart: "17:00",
  surgeEnd: "19:00",
};

describe("frete por distância e tempo", () => {
  it("base + km + minutos + taxa de serviço", () => {
    expect(quoteFee({ distanceKm: 4.2, durationMin: 12 }, cfg, "10:00")).toEqual({
      ok: true,
      breakdown: {
        distanceKm: 4.2, durationMin: 12, baseCents: 500, distanceCents: 630, timeCents: 360,
        surgeMultiplier: 1, surgeCents: 0, minimumAdjustCents: 0, serviceFeeCents: 100, totalCents: 1590,
      },
    });
  });

  it("corrida curta cobra a tarifa mínima", () => {
    const r = quoteFee({ distanceKm: 0.5, durationMin: 2 }, cfg, "10:00");
    expect(r.ok && r.breakdown.minimumAdjustCents).toBe(65);
    expect(r.ok && r.breakdown.totalCents).toBe(800);
  });

  it("horário de pico multiplica a corrida, não a taxa de serviço", () => {
    const r = quoteFee({ distanceKm: 4.2, durationMin: 12 }, cfg, "18:00");
    expect(r.ok && r.breakdown.surgeMultiplier).toBe(1.5);
    expect(r.ok && r.breakdown.surgeCents).toBe(745);
    expect(r.ok && r.breakdown.totalCents).toBe(2335);
  });

  it("fim do pico é exclusivo", () => {
    const r = quoteFee({ distanceKm: 4.2, durationMin: 12 }, cfg, "19:00");
    expect(r.ok && r.breakdown.surgeMultiplier).toBe(1);
  });

  it("acima do raio máximo não entrega", () => {
    expect(quoteFee({ distanceKm: 15.1, durationMin: 25 }, cfg, "10:00")).toEqual({ ok: false, reason: "TOO_FAR" });
  });

  it("sem pico configurado nunca multiplica", () => {
    const r = quoteFee({ distanceKm: 4.2, durationMin: 12 }, { ...cfg, surgeStart: null, surgeEnd: null }, "18:00");
    expect(r.ok && r.breakdown.totalCents).toBe(1590);
  });
});
