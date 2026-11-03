/** Data local no formato "YYYY-MM-DD" (sem fuso). */
export type LocalDate = string;

function parts(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDateOf(d: Date, tz: string): LocalDate {
  const p = parts(d, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function todayIn(tz: string, now: Date = new Date()): LocalDate {
  return localDateOf(now, tz);
}

export function utcToLocalHHmm(d: Date, tz: string): string {
  const p = parts(d, tz);
  return `${pad(p.h)}:${pad(p.min)}`;
}

/** Diferença (ms) entre o relógio local do fuso e UTC no instante dado. */
function offsetMs(d: Date, tz: string) {
  const p = parts(d, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

export function zonedToUtc(date: LocalDate, hhmm: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offsetMs(new Date(guess), tz);
  // segunda passada corrige casos de mudança de horário de verão
  return new Date(guess - offsetMs(new Date(first), tz));
}

export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** LocalDate -> Date em 00:00 UTC (formato usado em colunas @db.Date). */
export function dateColumn(date: LocalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Coluna @db.Date -> LocalDate. */
export function fromDateColumn(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmmOf(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
