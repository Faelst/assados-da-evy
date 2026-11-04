"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1046 : 784;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.23);
    });
  } catch {}
}

/** Consulta novos pedidos a cada 15s; ao chegar um, toca um alerta e atualiza a tela. */
export function NewOrdersWatcher() {
  const router = useRouter();
  const last = useRef<string | null>(null);
  const [alert, setAlert] = useState<{ code: string; id: string } | null>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const r = await fetch("/api/admin/pedidos/ultimo", { cache: "no-store" });
        if (!r.ok) return;
        const data: { id: string | null; code: string | null } = await r.json();
        if (last.current === null) last.current = data.id ?? "";
        else if (data.id && data.id !== last.current) {
          last.current = data.id;
          setAlert({ id: data.id, code: data.code ?? "" });
          beep();
          router.refresh();
        }
      } catch {}
    }
    poll();
    const t = setInterval(() => !stop && poll(), 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [router]);

  if (!alert) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-2xl" role="status">
      <BellRing className="size-5 animate-bounce text-amber" />
      <span className="font-semibold">Novo pedido {alert.code}</span>
      <Link href={`/admin/pedidos/${alert.id}`} className="rounded-full bg-amber px-3 py-1 text-sm font-bold text-ink" onClick={() => setAlert(null)}>
        Abrir
      </Link>
      <button className="text-cream/60" onClick={() => setAlert(null)} aria-label="Dispensar">×</button>
    </div>
  );
}
