import { describe, it, expect } from "vitest";
import { allocate } from "@/server/domain/allocation";
import type { BatchView } from "@/server/services/batches";

const at = (iso: string) => new Date(iso);
function batch(id: string, start: string, ready: string, free = 10): BatchView {
  return {
    id, productId: "panetone", productName: "Panetone", date: "2026-11-09",
    startsAt: at(start), readyAt: at(ready), capacityUnits: 10, usedUnits: 10 - free, heldUnits: 0,
    freeUnits: free, blocked: false, manual: false,
  };
}
// Segunda 09/11: fornadas 08–11, 11–14, 14–17 (SP) = 11Z–14Z, 14Z–17Z, 17Z–20Z
const batches = [
  batch("b11", "2026-11-09T11:00:00Z", "2026-11-09T14:00:00Z"),
  batch("b14", "2026-11-09T14:00:00Z", "2026-11-09T17:00:00Z"),
  batch("b17", "2026-11-09T17:00:00Z", "2026-11-09T20:00:00Z"),
];
const NOW = at("2026-11-03T12:00:00Z");
const lead = { panetone: 24 };

describe("alocação de encomenda nas fornadas", () => {
  it("25 panetones para as 17h usam da fornada mais tardia para a mais cedo", () => {
    expect(allocate([{ productId: "panetone", units: 25 }], batches, at("2026-11-09T20:00:00Z"), NOW, lead)).toEqual([
      { batchId: "b17", productId: "panetone", units: 10 },
      { batchId: "b14", productId: "panetone", units: 10 },
      { batchId: "b11", productId: "panetone", units: 5 },
    ]);
  });

  it("15 panetones para as 11h não cabem", () => {
    expect(allocate([{ productId: "panetone", units: 15 }], batches, at("2026-11-09T14:00:00Z"), NOW, lead)).toBeNull();
  });

  it("antecedência mínima exclui fornada que começa cedo demais", () => {
    const now = at("2026-11-08T13:00:00Z"); // 24h antes das 13Z de 09/11: exclui só b11
    expect(allocate([{ productId: "panetone", units: 25 }], batches, at("2026-11-09T20:00:00Z"), now, lead)).toBeNull();
    expect(allocate([{ productId: "panetone", units: 20 }], batches, at("2026-11-09T20:00:00Z"), now, lead)).toHaveLength(2);
  });

  it("fornada bloqueada não recebe pedido", () => {
    const blocked = batches.map((b) => (b.id === "b17" ? { ...b, blocked: true } : b));
    expect(allocate([{ productId: "panetone", units: 10 }], blocked, at("2026-11-09T20:00:00Z"), NOW, lead)).toEqual([
      { batchId: "b14", productId: "panetone", units: 10 },
    ]);
  });

  it("duas linhas do mesmo produto dividem as vagas", () => {
    const one = [batch("b17", "2026-11-09T17:00:00Z", "2026-11-09T20:00:00Z")];
    expect(
      allocate([{ productId: "panetone", units: 6 }, { productId: "panetone", units: 6 }], one, at("2026-11-09T20:00:00Z"), NOW, lead),
    ).toBeNull();
  });
});
