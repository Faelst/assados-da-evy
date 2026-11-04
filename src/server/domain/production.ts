import { hhmmOf, minutesOf } from "./time";

export type Shift = { opensAt: string; closesAt: string };
export type PlannedBatch = { productId: string; startTime: string; durationMin: number };
export type PlanError = { index: number; code: "OUTSIDE_HOURS" | "OVERLAP" };
export type PlanResult = { ok: true } | { ok: false; errors: PlanError[] };

export type BusinessHourRow = { weekday: number; opensAt: string; closesAt: string };
export type PlanRow = { weekday?: number; productId: string; startTime: string };
export type ExceptionInput = {
  type: "CLOSED" | "SPECIAL_HOURS" | "SPECIAL_MENU";
  opensAt: string | null;
  closesAt: string | null;
  plan: PlanRow[];
};
export type ResolvedDay = { closed: boolean; shifts: Shift[]; plan: { productId: string; startTime: string }[] };

const byStart = (a: Shift, b: Shift) => minutesOf(a.opensAt) - minutesOf(b.opensAt);

/** Gera fornadas seguidas de uma receita do início ao fim de cada turno. */
export function fillDay(productId: string, durationMin: number, shifts: Shift[]): PlannedBatch[] {
  const out: PlannedBatch[] = [];
  if (durationMin <= 0) return out;
  for (const s of [...shifts].sort(byStart)) {
    const end = minutesOf(s.closesAt);
    for (let t = minutesOf(s.opensAt); t + durationMin <= end; t += durationMin) {
      out.push({ productId, startTime: hhmmOf(t), durationMin });
    }
  }
  return out;
}

function fitsInShift(start: number, end: number, shifts: Shift[]) {
  return shifts.some((s) => start >= minutesOf(s.opensAt) && end <= minutesOf(s.closesAt));
}

/**
 * Valida o plano do dia: cada fornada inteira dentro de um turno e, em nenhum
 * instante, mais fornadas simultâneas do que `parallel`.
 */
export function validatePlan(batches: PlannedBatch[], shifts: Shift[], parallel: number): PlanResult {
  const errors: PlanError[] = [];
  const outside = new Set<number>();
  batches.forEach((b, index) => {
    const start = minutesOf(b.startTime);
    if (!fitsInShift(start, start + b.durationMin, shifts)) {
      errors.push({ index, code: "OUTSIDE_HOURS" });
      outside.add(index);
    }
  });

  // varredura: processa as fornadas em ordem de início; a que estoura o limite é marcada
  const order = batches
    .map((b, index) => ({ index, start: minutesOf(b.startTime), end: minutesOf(b.startTime) + b.durationMin }))
    .sort((a, b) => a.start - b.start || a.index - b.index);
  const running: { end: number }[] = [];
  for (const b of order) {
    for (let i = running.length - 1; i >= 0; i--) if (running[i].end <= b.start) running.splice(i, 1);
    if (running.length >= parallel) {
      if (!outside.has(b.index)) errors.push({ index: b.index, code: "OVERLAP" });
      continue;
    }
    running.push({ end: b.end });
  }

  errors.sort((a, b) => a.index - b.index);
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Aplica horário semanal, plano semanal e exceção da data. */
export function resolveDay(input: {
  weekday: number;
  hours: BusinessHourRow[];
  plan: PlanRow[];
  exception?: ExceptionInput | null;
  /** duração (min) por produto, usada para descartar fornadas fora do horário especial */
  durations?: Record<string, number>;
}): ResolvedDay {
  const { weekday, exception } = input;
  if (exception?.type === "CLOSED") return { closed: true, shifts: [], plan: [] };

  let shifts: Shift[] = input.hours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ opensAt: h.opensAt, closesAt: h.closesAt }))
    .sort(byStart);
  let plan = input.plan
    .filter((p) => p.weekday === undefined || p.weekday === weekday)
    .map((p) => ({ productId: p.productId, startTime: p.startTime }));

  if (exception?.type === "SPECIAL_HOURS" && exception.opensAt && exception.closesAt) {
    shifts = [{ opensAt: exception.opensAt, closesAt: exception.closesAt }];
  }
  if (exception?.type === "SPECIAL_MENU") {
    plan = exception.plan.map((p) => ({ productId: p.productId, startTime: p.startTime }));
    if (exception.opensAt && exception.closesAt) shifts = [{ opensAt: exception.opensAt, closesAt: exception.closesAt }];
  }

  if (shifts.length === 0) return { closed: true, shifts: [], plan: [] };

  if (exception && input.durations) {
    const d = input.durations;
    plan = plan.filter((p) => {
      const start = minutesOf(p.startTime);
      return fitsInShift(start, start + (d[p.productId] ?? 0), shifts);
    });
  }

  plan.sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));
  return { closed: false, shifts, plan };
}

export function isOpenAt(shifts: Shift[], hhmm: string): boolean {
  const t = minutesOf(hhmm);
  return shifts.some((s) => t >= minutesOf(s.opensAt) && t < minutesOf(s.closesAt));
}
