export type AllocBatch = {
  id: string;
  productId: string;
  startsAt: Date;
  readyAt: Date;
  freeUnits: number;
  blocked: boolean;
};
export type Allocation = { batchId: string; productId: string; units: number }[];

const HOUR = 3_600_000;

/** A fornada pode receber encomenda feita agora? (não bloqueada e respeita a antecedência) */
export function isBookable(b: AllocBatch, now: Date, leadHours: number): boolean {
  return !b.blocked && b.startsAt.getTime() >= now.getTime() + leadHours * HOUR;
}

/**
 * Aloca as unidades de cada item em fornadas do mesmo produto prontas até `handoffAt`,
 * da mais tardia (mais fresca) para a mais cedo, podendo dividir entre fornadas.
 * Devolve null se algum item não couber.
 */
export function allocate(
  items: { productId: string; units: number }[],
  batches: AllocBatch[],
  handoffAt: Date,
  now: Date,
  leadHoursByProduct: Record<string, number>,
): Allocation | null {
  const free = new Map(batches.map((b) => [b.id, b.freeUnits]));
  const totals = new Map<string, number>();
  const out: Allocation = [];

  for (const item of items) {
    let need = item.units;
    const candidates = batches
      .filter(
        (b) =>
          b.productId === item.productId &&
          b.readyAt.getTime() <= handoffAt.getTime() &&
          isBookable(b, now, leadHoursByProduct[item.productId] ?? 0),
      )
      .sort((a, b) => b.readyAt.getTime() - a.readyAt.getTime());

    for (const b of candidates) {
      if (need <= 0) break;
      const take = Math.min(need, free.get(b.id) ?? 0);
      if (take <= 0) continue;
      free.set(b.id, (free.get(b.id) ?? 0) - take);
      need -= take;
      totals.set(b.id, (totals.get(b.id) ?? 0) + take);
    }
    if (need > 0) return null;
  }

  for (const [batchId, units] of totals) {
    const b = batches.find((x) => x.id === batchId)!;
    out.push({ batchId, productId: b.productId, units });
  }
  return out.sort(
    (a, b) =>
      batches.find((x) => x.id === b.batchId)!.readyAt.getTime() - batches.find((x) => x.id === a.batchId)!.readyAt.getTime(),
  );
}
