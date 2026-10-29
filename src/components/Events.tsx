"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, useState, type FormEvent } from "react";
import { BRAND, waLink } from "@/lib/data";
import { isValidName, isValidPhone, maskPhone, sendLead, storeLead, useStoredLead, type Lead } from "@/lib/leads";
import { Field } from "./Field";
import { WhatsAppIcon } from "./icons";
import { Reveal } from "./Reveal";

const OCCASIONS = [
  { emoji: "🏢", title: "Eventos corporativos", text: "Coffee breaks, reuniões, treinamentos, SIPAT e confraternizações de fim de ano. Tudo combinado com antecedência para chegar no horário certo." },
  { emoji: "🎂", title: "Aniversários", text: "Assadinhos no mix de sabores que você escolher, prontos para servir e fazer sucesso com adultos e crianças." },
  { emoji: "💍", title: "Casamentos & noivados", text: "Um cardápio salgado afetivo para recepções, chás e pré-wedding — em quantidades sob medida." },
  { emoji: "🎉", title: "Festas & encontros", text: "Chá revelação, batizado, churrasco da família ou futebol com os amigos. A gente cuida do salgado." },
];

const STEPS = [
  { n: "01", title: "Conte sobre o evento", text: "Data, número de convidados e o que você imagina." },
  { n: "02", title: "Receba a proposta", text: "Montamos quantidades e sabores ideais para o seu público." },
  { n: "03", title: "Confirme a encomenda", text: "Reservamos a data na nossa agenda de produção." },
  { n: "04", title: "É só aproveitar", text: "Tudo assadinho e quentinho no dia combinado." },
];

const EVENT_TYPES = ["Corporativo", "Aniversário", "Casamento", "Festa / encontro", "Outro"];

function OccasionsScroller() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-62%"]);

  return (
    <div ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-4">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber">Encomendas para eventos</p>
          <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.8rem)] font-extrabold leading-[0.95] tracking-tight">
            Seu evento merece <span className="text-amber">1 cadin de tudo.</span>
          </h2>
        </div>
        <motion.ul style={{ x }} className="mt-12 flex w-max gap-5 pl-[max(1rem,calc((100vw-72rem)/2+1rem))]">
          {OCCASIONS.map((o) => (
            <li
              key={o.title}
              className="flex h-[52svh] min-h-80 w-[78vw] max-w-md flex-col justify-between rounded-[2rem] bg-cream/[0.07] p-8 ring-1 ring-cream/15 backdrop-blur"
            >
              <span className="text-6xl">{o.emoji}</span>
              <div>
                <h3 className="font-display text-3xl font-bold">{o.title}</h3>
                <p className="mt-3 text-lg leading-relaxed text-cream/75">{o.text}</p>
              </div>
            </li>
          ))}
          <li className="flex h-[52svh] min-h-80 w-[78vw] max-w-md flex-col justify-end rounded-[2rem] bg-amber p-8 text-ink">
            <h3 className="font-display text-3xl font-bold">Vamos planejar juntos?</h3>
            <p className="mt-3 text-lg">Solicite um orçamento sem compromisso logo abaixo.</p>
          </li>
        </motion.ul>
      </div>
    </div>
  );
}

function EventForm({ known }: { known: Lead | null }) {
  // Nome e WhatsApp ficam null até o cliente editar; enquanto isso usamos o contato já conhecido.
  const [draft, setForm] = useState({
    name: null as string | null,
    phone: null as string | null,
    email: "",
    company: "",
    eventType: "Corporativo",
    date: "",
    guests: "",
    details: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const form = {
    ...draft,
    name: draft.name ?? known?.name ?? "",
    phone: draft.phone ?? (known ? maskPhone(known.phone) : ""),
  };

  const set = (k: keyof typeof draft) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: k === "phone" ? maskPhone(e.target.value) : e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isValidName(form.name)) errs.name = "Informe seu nome";
    if (!isValidPhone(form.phone)) errs.phone = "Informe um WhatsApp válido com DDD";
    if (!form.date) errs.date = "Informe a data do evento";
    else if (form.date < new Date().toLocaleDateString("sv-SE")) errs.date = "Escolha uma data futura";
    if (!form.guests || Number(form.guests) < 1) errs.guests = "Quantas pessoas?";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const phone = form.phone.replace(/\D/g, "");
    storeLead({ name: form.name.trim(), phone });
    void sendLead({ type: "evento", ...form, phone });

    const date = new Date(form.date + "T12:00:00").toLocaleDateString("pt-BR");
    const msg = [
      `Olá, Evy! Gostaria de um orçamento para evento 🎉`,
      ``,
      `*Nome:* ${form.name.trim()}`,
      form.company && `*Empresa:* ${form.company}`,
      `*Tipo de evento:* ${form.eventType}`,
      `*Data:* ${date}`,
      `*Convidados:* ${form.guests}`,
      form.email && `*E-mail:* ${form.email}`,
      form.details && `*Detalhes:* ${form.details}`,
    ]
      .filter(Boolean)
      .join("\n");

    setSent(true);
    window.open(waLink(msg), "_blank", "noopener,noreferrer");
  }

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2rem] bg-cream p-10 text-center text-ink">
        <p className="text-5xl">🧡</p>
        <h3 className="mt-4 font-display text-3xl font-bold">Pedido de orçamento enviado!</h3>
        <p className="mx-auto mt-3 max-w-md text-ink/70">
          Abrimos o WhatsApp com os dados do seu evento. Se a janela não abriu,{" "}
          <a className="font-bold text-terracotta underline" href={waLink("Olá, Evy! Gostaria de um orçamento para evento 🎉")} target="_blank" rel="noopener noreferrer">
            clique aqui
          </a>
          . Respondemos rapidinho!
        </p>
        <button onClick={() => setSent(false)} className="mt-6 text-sm font-bold text-terracotta">
          Enviar outro pedido
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-[2rem] bg-cream/[0.06] p-6 ring-1 ring-cream/15 sm:grid-cols-2 sm:p-10">
      <Field dark label="Seu nome *" value={form.name} onChange={set("name")} error={errors.name} autoComplete="name" placeholder="Como podemos te chamar?" />
      <Field dark label="WhatsApp *" value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="tel" autoComplete="tel" placeholder="(12) 99999-9999" />
      <Field dark label="E-mail" type="email" value={form.email} onChange={set("email")} autoComplete="email" placeholder="opcional" />
      <Field dark label="Empresa" value={form.company} onChange={set("company")} placeholder="para eventos corporativos" />

      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-bold text-cream/90">Tipo de evento</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setForm((f) => ({ ...f, eventType: t }))}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                form.eventType === t ? "bg-amber text-ink" : "bg-cream/10 text-cream/80 hover:bg-cream/20"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <Field dark label="Data do evento *" type="date" value={form.date} onChange={set("date")} error={errors.date} />
      <Field dark label="Nº de convidados *" type="number" min={1} value={form.guests} onChange={set("guests")} error={errors.guests} placeholder="ex.: 40" />

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-bold text-cream/90">Conte mais sobre o evento</span>
        <textarea
          value={form.details}
          onChange={set("details")}
          rows={4}
          placeholder="Horário, local de entrega, sabores preferidos, restrições…"
          className="w-full rounded-2xl border border-cream/20 bg-cream/10 px-4 py-3 text-base font-medium text-cream outline-none transition placeholder:text-cream/45 focus:border-amber focus:ring-4 focus:ring-amber/25"
        />
      </label>

      <div className="flex flex-col items-start gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-cream/60">Ao enviar, você será direcionado ao WhatsApp {BRAND.whatsappDisplay}.</p>
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-amber px-7 py-3.5 font-bold text-ink transition hover:scale-[1.03] hover:bg-[#ffb862]">
          <WhatsAppIcon className="size-5" /> Solicitar orçamento
        </button>
      </div>
    </form>
  );
}

export function Events() {
  // Reaproveita o contato já informado no orçamento, se houver.
  const lead = useStoredLead();
  return (
    <section id="eventos" className="grain relative bg-ink text-cream">
      <OccasionsScroller />

      <div className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <Reveal>
          <h3 className="font-display text-4xl font-extrabold sm:text-5xl">Como funciona</h3>
        </Reveal>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <li className="border-t border-cream/20 pt-5">
                <span className="font-display text-5xl font-extrabold text-amber">{s.n}</span>
                <h4 className="mt-2 font-display text-2xl font-bold">{s.title}</h4>
                <p className="mt-1 text-cream/70">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <div id="orcamento-evento" className="mt-24 grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <Reveal>
            <p className="font-script text-3xl text-amber">sem compromisso</p>
            <h3 className="mt-1 font-display text-4xl font-extrabold leading-tight sm:text-5xl">Orçamento para eventos</h3>
            <p className="mt-4 text-lg text-cream/75">
              Para eventos e pedidos corporativos, encomende com antecedência para garantirmos sua data na agenda de
              produção. Estamos em Jacareí/SP.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <EventForm known={lead} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
