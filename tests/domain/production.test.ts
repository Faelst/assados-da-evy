import { describe, it, expect } from "vitest";
import { fillDay, validatePlan, resolveDay, isOpenAt } from "@/server/domain/production";

const day = [{ opensAt: "08:00", closesAt: "18:00" }];

describe("preencher dia", () => {
  it("panetone de 3h num dia de 8h às 18h", () => {
    expect(fillDay("p", 180, day).map((b) => b.startTime)).toEqual(["08:00", "11:00", "14:00"]);
  });
  it("respeita dois turnos", () => {
    const shifts = [{ opensAt: "08:00", closesAt: "12:00" }, { opensAt: "14:00", closesAt: "18:00" }];
    expect(fillDay("p", 120, shifts).map((b) => b.startTime)).toEqual(["08:00", "10:00", "14:00", "16:00"]);
  });
});

describe("validar plano", () => {
  const plan = [
    { productId: "panetone", startTime: "08:00", durationMin: 180 },
    { productId: "hamburgao", startTime: "10:00", durationMin: 120 },
  ];
  it("uma fornada por vez acusa sobreposição", () => {
    expect(validatePlan(plan, day, 1)).toEqual({ ok: false, errors: [{ index: 1, code: "OVERLAP" }] });
  });
  it("duas fornadas simultâneas aceita", () => {
    expect(validatePlan(plan, day, 2)).toEqual({ ok: true });
  });
  it("fornadas encostadas não se sobrepõem", () => {
    const seq = [
      { productId: "a", startTime: "08:00", durationMin: 180 },
      { productId: "b", startTime: "11:00", durationMin: 120 },
    ];
    expect(validatePlan(seq, day, 1)).toEqual({ ok: true });
  });
  it("fornada que passa do fechamento", () => {
    expect(validatePlan([{ productId: "p", startTime: "17:00", durationMin: 180 }], day, 1)).toEqual({
      ok: false,
      errors: [{ index: 0, code: "OUTSIDE_HOURS" }],
    });
  });
});

describe("resolver o dia", () => {
  const hours = [{ weekday: 1, opensAt: "08:00", closesAt: "18:00" }];
  const plan = [
    { weekday: 1, productId: "panetone", startTime: "08:00" },
    { weekday: 1, productId: "panetone", startTime: "14:00" },
  ];
  it("dia normal usa horário e plano da semana", () => {
    const r = resolveDay({ weekday: 1, hours, plan });
    expect(r.closed).toBe(false);
    expect(r.shifts).toEqual(day);
    expect(r.plan).toEqual([
      { productId: "panetone", startTime: "08:00" },
      { productId: "panetone", startTime: "14:00" },
    ]);
  });
  it("dia sem horário é fechado", () => {
    expect(resolveDay({ weekday: 0, hours, plan }).closed).toBe(true);
  });
  it("exceção de dia fechado", () => {
    const r = resolveDay({ weekday: 1, hours, plan, exception: { type: "CLOSED", opensAt: null, closesAt: null, plan: [] } });
    expect(r.closed).toBe(true);
    expect(r.plan).toEqual([]);
  });
  it("horário especial descarta fornadas fora dele", () => {
    const r = resolveDay({
      weekday: 1, hours, plan, durations: { panetone: 180 },
      exception: { type: "SPECIAL_HOURS", opensAt: "08:00", closesAt: "12:00", plan: [] },
    });
    expect(r.shifts).toEqual([{ opensAt: "08:00", closesAt: "12:00" }]);
    expect(r.plan).toEqual([{ productId: "panetone", startTime: "08:00" }]);
  });
  it("cardápio especial troca o plano", () => {
    const r = resolveDay({
      weekday: 1, hours, plan,
      exception: { type: "SPECIAL_MENU", opensAt: null, closesAt: null, plan: [{ productId: "natal", startTime: "09:00" }] },
    });
    expect(r.plan).toEqual([{ productId: "natal", startTime: "09:00" }]);
  });
});

describe("aberto agora", () => {
  it("dentro e fora do turno", () => {
    expect(isOpenAt(day, "08:00")).toBe(true);
    expect(isOpenAt(day, "18:00")).toBe(false);
  });
});
