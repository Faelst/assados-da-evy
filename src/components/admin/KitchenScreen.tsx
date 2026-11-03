"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bike, Bell, BellOff, CalendarClock, Flame, Maximize, Store } from "lucide-react";
import type { KitchenBoard, KitchenCard } from "@/server/services/kitchen";
import { nextStatuses, ACTION_LABEL, type Role, type OrderStatus } from "@/server/domain/order-status";
import { advanceOrderAction } from "@/app/admin/cozinha/actions";

const COLUMNS = [
  { key: "NEW", title: "Novos", hint: "Aguardando confirmação", accent: "bg-amber text-ink" },
  { key: "TODO", title: "A fazer", hint: "Confirmados", accent: "bg-sky-400 text-ink" },
  { key: "PREPARING", title: "Em preparo", hint: "No forno", accent: "bg-orange-500 text-white" },
  { key: "READY", title: "Prontos", hint: "Retirada ou entrega", accent: "bg-emerald-500 text-white" },
] as const;

const POLL_MS = 5000;

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.18, 0.36, 0.9, 1.08, 1.26].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = [784, 988, 1175][i % 3];
      g.gain.setValueAtTime(0.35, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.32);
    });
  } catch {}
}

function waitClass(min: number, status: OrderStatus) {
  if (status === "READY" || status === "OUT_FOR_DELIVERY") return "text-white/60";
  if (min >= 30) return "text-tomato";
  if (min >= 15) return "text-amber";
  return "text-white/60";
}

function Card({ c, role, fresh, onAdvance, busy }: { c: KitchenCard; role: Role; fresh: boolean; onAdvance: (id: string, to: OrderStatus) => void; busy: boolean }) {
  const next = nextStatuses(c.status, { type: c.type, fulfillment: c.fulfillment, role }).filter((s) => s !== "CANCELLED");
  return (
    <article className={`rounded-2xl bg-white/[0.07] p-4 ring-1 transition ${fresh ? "animate-pulse ring-4 ring-amber" : "ring-white/10"}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-extrabold leading-none text-white">{c.code}</p>
          <p className="mt-1 text-sm text-white/70">{c.customer}</p>
        </div>
        <div className="text-right">
          <p className={`font-display text-xl font-bold tabular-nums ${waitClass(c.minutesAgo, c.status)}`}>{c.minutesAgo} min</p>
          <p className="text-xs text-white/50">desde o pedido</p>
        </div>
      </header>

      <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
        {c.type === "SCHEDULED" ? (
          <span className="chip bg-sky-400/20 text-sky-200"><CalendarClock className="size-3.5" /> Encomenda {c.handoffDate ? `${c.handoffDate} ` : ""}{c.handoff}</span>
        ) : (
          <span className="chip bg-amber/20 text-amber"><Flame className="size-3.5" /> Pronta entrega</span>
        )}
        {c.fulfillment === "DELIVERY" ? (
          <span className="chip bg-violet-400/20 text-violet-200"><Bike className="size-3.5" /> Entrega{c.district ? ` · ${c.district}` : ""}</span>
        ) : (
          <span className="chip bg-white/10 text-white/80"><Store className="size-3.5" /> Retirada</span>
        )}
      </div>

      <ul className="mt-3 space-y-1">
        {c.items.map((i, idx) => (
          <li key={idx} className="text-lg leading-snug text-white">
            <strong className="mr-1.5 tabular-nums text-amber">{i.qty}×</strong>
            {i.name}
            {i.notes && <span className="block text-sm text-amber/90">↳ {i.notes}</span>}
          </li>
        ))}
      </ul>
      {c.notes && <p className="mt-2 rounded-xl bg-amber/15 p-2 text-sm text-amber">Obs.: {c.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {next.map((to) => (
          <button
            key={to}
            type="button"
            disabled={busy}
            onClick={() => onAdvance(c.id, to)}
            className="flex-1 rounded-xl bg-cream px-3 py-3 text-base font-bold text-ink transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
          >
            {ACTION_LABEL[to] ?? to}
          </button>
        ))}
        <Link href={`/admin/pedidos/${c.id}`} target="_blank" className="rounded-xl px-3 py-3 text-sm font-semibold text-white/60 hover:text-white">
          Detalhes
        </Link>
      </div>
    </article>
  );
}

export function KitchenScreen({ initial, role }: { initial: KitchenBoard; role: Role }) {
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [sound, setSound] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [busy, startTransition] = useTransition();
  const known = useRef(new Set(Object.values(initial.columns).flat().map((c) => c.id)));
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/cozinha", { cache: "no-store" });
      if (r.status === 401) {
        router.push("/admin/login?next=/admin/cozinha");
        return;
      }
      if (!r.ok) throw new Error();
      const data: KitchenBoard = await r.json();
      const ids = Object.values(data.columns).flat().map((c) => c.id);
      const arrived = data.columns.NEW.filter((c) => !known.current.has(c.id)).map((c) => c.id);
      ids.forEach((id) => known.current.add(id));
      if (arrived.length) {
        if (soundRef.current) chime();
        setFresh((f) => new Set([...f, ...arrived]));
        setTimeout(() => setFresh((f) => new Set([...f].filter((id) => !arrived.includes(id)))), 60_000);
      }
      setBoard(data);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [router]);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  function advance(id: string, to: OrderStatus) {
    startTransition(async () => {
      const r = await advanceOrderAction(id, to);
      setError(r.error ?? null);
      await refresh();
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link href="/admin" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Voltar ao painel">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold">Cozinha ao vivo</h1>
        <span className={`chip ${online ? "bg-emerald-500/20 text-emerald-300" : "bg-tomato/30 text-white"}`}>
          <span className={`size-2 rounded-full ${online ? "animate-pulse bg-emerald-400" : "bg-tomato"}`} />
          {online ? "Atualizando a cada 5 s" : "Sem conexão — tentando de novo"}
        </span>
        <span className="ml-auto font-display text-3xl font-bold tabular-nums">{clock}</span>
        <button
          type="button"
          onClick={() => {
            setSound((s) => !s);
            if (!sound) chime();
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${sound ? "bg-emerald-500 text-white" : "animate-pulse bg-amber text-ink"}`}
        >
          {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />} {sound ? "Som ligado" : "Ligar som"}
        </button>
        <button
          type="button"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
          className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Tela cheia"
        >
          <Maximize className="size-5" />
        </button>
      </header>
      {error && <p className="bg-tomato px-4 py-2 text-sm font-semibold" role="alert">{error}</p>}

      <main className="grid flex-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = board.columns[col.key];
          return (
            <section key={col.key} className="flex min-h-0 flex-col rounded-3xl bg-white/[0.03] p-3">
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold">{col.title}</h2>
                  <p className="text-xs text-white/50">{col.hint}</p>
                </div>
                <span className={`grid min-w-10 place-items-center rounded-full px-3 py-1 font-display text-xl font-bold ${col.accent}`}>{cards.length}</span>
              </header>
              <div className="flex flex-col gap-3 overflow-y-auto">
                {cards.length === 0 && <p className="py-8 text-center text-sm text-white/30">Nada aqui</p>}
                {cards.map((c) => (
                  <Card key={c.id} c={c} role={role} fresh={fresh.has(c.id)} onAdvance={advance} busy={busy} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
