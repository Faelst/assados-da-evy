"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      <Printer className="size-4" /> Imprimir comanda
    </button>
  );
}
