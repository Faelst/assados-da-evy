"use client";

import { Minus, Plus } from "lucide-react";

export function QtyStepper({ value, onChange, max, min = 0 }: { value: number; onChange: (v: number) => void; max?: number; min?: number }) {
  return (
    <div className="inline-flex items-center rounded-full border border-terracotta/20 bg-white">
      <button type="button" aria-label="Diminuir" className="grid size-9 place-items-center rounded-full text-terracotta disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="Aumentar" className="grid size-9 place-items-center rounded-full text-terracotta disabled:opacity-30" disabled={max !== undefined && value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}
