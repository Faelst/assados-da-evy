import { describe, it, expect } from "vitest";
import { todayIn, weekdayOf, zonedToUtc, utcToLocalHHmm, addDays, minutesOf, hhmmOf, localDateOf } from "@/server/domain/time";

const SP = "America/Sao_Paulo";

describe("tempo no fuso da loja", () => {
  it("23:30 em SP (02:30Z do dia seguinte) ainda é o dia anterior", () => {
    expect(todayIn(SP, new Date("2026-11-04T02:30:00Z"))).toBe("2026-11-03");
  });
  it("converte horário local de SP para UTC", () => {
    expect(zonedToUtc("2026-11-03", "08:00", SP).toISOString()).toBe("2026-11-03T11:00:00.000Z");
  });
  it("converte UTC para HH:mm local", () => {
    expect(utcToLocalHHmm(new Date("2026-11-03T14:00:00Z"), SP)).toBe("11:00");
  });
  it("data local de um instante", () => {
    expect(localDateOf(new Date("2026-11-04T02:30:00Z"), SP)).toBe("2026-11-03");
  });
  it("dia da semana (0 = domingo)", () => {
    expect(weekdayOf("2026-11-02")).toBe(1);
    expect(weekdayOf("2026-11-08")).toBe(0);
  });
  it("soma dias atravessando o ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("minutos <-> HH:mm", () => {
    expect(minutesOf("14:30")).toBe(870);
    expect(hhmmOf(870)).toBe("14:30");
  });
});
