"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type FormEvent } from "react";
import { ASSADINHO_FLAVORS, CATEGORIES, MENU, brl, waLink, type MenuItem } from "@/lib/data";
import { clearLead, useStoredLead, isValidName, isValidPhone, maskPhone, sendLead, storeLead, type Lead } from "@/lib/leads";
import { Field } from "./Field";
import { WhatsAppIcon } from "./icons";
import { EASE, Reveal } from "./Reveal";

type Cart = Record<string, { qty: number; flavors: string[] }>;

function LeadGate() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!isValidName(name)) errs.name = "Informe seu nome";
    if (!isValidPhone(phone)) errs.phone = "Informe um WhatsApp válido com DDD";
    setErrors(errs);
    if (errs.name || errs.phone) return;

    setLoading(true);
    const lead = { name: name.trim(), phone: phone.replace(/\D/g, "") };
    await sendLead({ type: "contato", ...lead, origem: "orcamento" });
    storeLead(lead);
  }

  return (
    <motion.form
      key="gate"
      onSubmit={onSubmit}
      noValidate
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mx-auto max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl shadow-terracotta/15 sm:p-10"
    >
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-amber/25 text-2xl">🔓</span>
        <div>
          <h3 className="font-display text-2xl font-bold leading-tight">Libere os valores</h3>
          <p className="text-sm text-ink/60">Informe seu nome e WhatsApp para ver os preços e montar seu pedido.</p>
        </div>
      </div>
      <div className="grid gap-4">
        <Field label="Seu nome" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" placeholder="Como podemos te chamar?" />
        <Field
          label="WhatsApp"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          error={errors.phone}
          inputMode="tel"
          autoComplete="tel"
          placeholder="(12) 99999-9999"
          hint="Usamos apenas para retornar sobre o seu orçamento."
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-terracotta py-3.5 font-bold text-cream shadow-lg shadow-terracotta/25 transition hover:bg-terracotta-dark disabled:opacity-60"
      >
        {loading ? "Liberando…" : "Ver valores e montar orçamento"}
      </button>
    </motion.form>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-cream-deep/60 p-1">
      <button type="button" aria-label="Diminuir" onClick={() => onChange(Math.max(0, value - 1))} className="grid size-8 place-items-center rounded-full text-lg font-bold transition hover:bg-white disabled:opacity-30" disabled={value === 0}>
        −
      </button>
      <span className="w-6 text-center font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="Aumentar" onClick={() => onChange(value + 1)} className="grid size-8 place-items-center rounded-full bg-terracotta text-lg font-bold text-cream transition hover:bg-terracotta-dark">
        +
      </button>
    </div>
  );
}

function ItemRow({ item, entry, onChange }: { item: MenuItem; entry?: Cart[string]; onChange: (e: Cart[string]) => void }) {
  const qty = entry?.qty ?? 0;
  const flavors = entry?.flavors ?? [];

  const toggleFlavor = (f: string) => {
    const next = flavors.includes(f) ? flavors.filter((x) => x !== f) : flavors.length < (item.flavors ?? 0) ? [...flavors, f] : flavors;
    onChange({ qty: qty || 1, flavors: next });
  };

  return (
    <li className={`rounded-2xl border p-4 transition sm:p-5 ${qty ? "border-terracotta/40 bg-white shadow-md shadow-terracotta/10" : "border-terracotta/10 bg-white/60"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{item.name}</p>
          <p className="mt-0.5 text-sm text-ink/60">{item.flavors ? `Até ${item.flavors} sabores` : item.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-display text-lg font-bold text-terracotta">{brl(item.price)}</span>
          <Stepper value={qty} onChange={(v) => onChange({ qty: v, flavors: v ? flavors : [] })} />
        </div>
      </div>
      {item.flavors && qty > 0 && (
        <div className="mt-4 border-t border-terracotta/10 pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink/50">
            Sabores ({flavors.length}/{item.flavors})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ASSADINHO_FLAVORS.map((f) => {
              const on = flavors.includes(f);
              const full = !on && flavors.length >= (item.flavors ?? 0);
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => toggleFlavor(f)}
                  disabled={full}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${on ? "bg-terracotta text-cream" : "bg-cream-deep/60 text-ink/70 hover:bg-cream-deep"} disabled:opacity-35`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}

function Builder({ lead, onReset }: { lead: Lead; onReset: () => void }) {
  const [cart, setCart] = useState<Cart>({});
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);

  const lines = useMemo(
    () => MENU.filter((m) => cart[m.id]?.qty).map((m) => ({ item: m, ...cart[m.id] })),
    [cart],
  );
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  function submit() {
    if (!lines.length) return;
    const items = lines.map((l) => ({ id: l.item.id, name: l.item.name, qty: l.qty, unit: l.item.price, flavors: l.flavors }));
    void sendLead({ type: "orcamento", ...lead, items, total, date, notes });

    const when = date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR") : "a combinar";
    const msg = [
      `Olá, Evy! Sou ${lead.name} e montei este orçamento pelo site 😋`,
      ``,
      ...lines.map((l) => `• ${l.qty}x ${l.item.name} — ${brl(l.item.price * l.qty)}${l.flavors.length ? `\n   Sabores: ${l.flavors.join(", ")}` : ""}`),
      ``,
      `*Total estimado:* ${brl(total)}`,
      `*Para quando:* ${when}`,
      notes ? `*Observações:* ${notes}` : null,
    ]
      .filter((x) => x !== null)
      .join("\n");

    setSent(true);
    window.open(waLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <motion.div key="builder" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 px-5 py-3">
        <p className="font-semibold">
          Olá, <span className="text-terracotta">{lead.name.split(" ")[0]}</span>! Monte seu pedido abaixo 👇
        </p>
        <button onClick={onReset} className="text-sm font-bold text-ink/50 hover:text-terracotta">
          Não é você?
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-10">
          {CATEGORIES.map((c) => (
            <div key={c.id}>
              <h3 className="font-display text-2xl font-extrabold">{c.title}</h3>
              <p className="mb-4 text-sm font-semibold text-tomato">{c.subtitle}</p>
              <ul className="grid gap-3">
                {MENU.filter((m) => m.category === c.id).map((m) => (
                  <ItemRow key={m.id} item={m} entry={cart[m.id]} onChange={(e) => setCart((prev) => ({ ...prev, [m.id]: e }))} />
                ))}
              </ul>
            </div>
          ))}
          <p className="rounded-2xl bg-amber/20 px-5 py-4 text-sm font-semibold">
            Precisa de mais de 100 assadinhos? Maiores quantidades são a combinar — use o campo de observações ou o formulário de eventos.
          </p>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-[2rem] bg-ink p-6 text-cream shadow-2xl sm:p-7">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-2xl font-bold">Seu orçamento</h3>
              <span className="text-sm text-cream/60">{count} {count === 1 ? "item" : "itens"}</span>
            </div>

            <AnimatePresence initial={false}>
              {lines.length === 0 ? (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-8 text-center text-cream/50">
                  Adicione itens para ver o total.
                </motion.p>
              ) : (
                <motion.ul key="list" className="my-5 space-y-3 border-y border-cream/10 py-5">
                  {lines.map((l) => (
                    <motion.li layout key={l.item.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex justify-between gap-3 text-sm">
                      <span>
                        <b>{l.qty}×</b> {l.item.name}
                        {l.flavors.length > 0 && <span className="block text-xs text-cream/55">{l.flavors.join(", ")}</span>}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{brl(l.item.price * l.qty)}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>

            <div className="flex items-baseline justify-between">
              <span className="text-cream/70">Total estimado</span>
              <motion.span key={total} initial={{ scale: 1.15, color: "#f8a94d" }} animate={{ scale: 1, color: "#fde5d8" }} className="font-display text-3xl font-extrabold tabular-nums">
                {brl(total)}
              </motion.span>
            </div>

            <div className="mt-5 grid gap-3">
              <Field dark label="Para quando?" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-cream/90">Observações</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Requeijão ou cheddar, horário, retirada/entrega…"
                  className="w-full rounded-2xl border border-cream/20 bg-cream/10 px-4 py-3 text-sm text-cream outline-none placeholder:text-cream/45 focus:border-amber focus:ring-4 focus:ring-amber/25"
                />
              </label>
            </div>

            <button
              onClick={submit}
              disabled={!lines.length}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-amber py-3.5 font-bold text-ink transition hover:bg-[#ffb862] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <WhatsAppIcon className="size-5" /> Enviar orçamento
            </button>
            <p className="mt-3 text-center text-xs text-cream/50">
              {sent ? "Abrimos o WhatsApp com seu pedido. Já já te respondemos!" : "Valores sujeitos a confirmação de disponibilidade."}
            </p>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}

export function Quote() {
  // Quem já se identificou não precisa preencher de novo.
  const lead = useStoredLead();

  return (
    <section id="orcamento" className="px-4 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-terracotta">Orçamento online</p>
          <h2 className="mt-3 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-none tracking-tight">
            Monte o seu pedido.
            <br />
            <span className="text-warm-gradient">A gente faz com carinho.</span>
          </h2>
        </Reveal>

        <AnimatePresence mode="wait">
          {lead ? (
            <Builder key="builder" lead={lead} onReset={clearLead} />
          ) : (
            <LeadGate key="gate" />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
