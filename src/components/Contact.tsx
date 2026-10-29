"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { BRAND, waLink } from "@/lib/data";
import { InstagramIcon, WhatsAppIcon } from "./icons";
import { Reveal } from "./Reveal";

export function Contact() {
  return (
    <section id="contato" className="grain relative overflow-hidden bg-terracotta px-4 py-28 text-cream sm:py-36">
      <motion.div
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 80, ease: "linear" }}
        className="pointer-events-none absolute -right-40 -top-40 w-[34rem] opacity-[0.08]"
      >
        <Image src="/img/logo.webp" alt="" width={600} height={600} />
      </motion.div>

      <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-2">
        <Reveal>
          <p className="font-script text-4xl text-amber">vem provar!</p>
          <h2 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight">
            A gente tá esperando seu pedido.
          </h2>
          <p className="mt-6 max-w-md text-lg text-cream/80">
            🕘 {BRAND.hoursNote}
            <br />📍 {BRAND.city}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={waLink("Olá! Vim pelo site e gostaria de fazer um pedido 😊")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3.5 font-bold text-terracotta transition hover:scale-[1.03]"
            >
              <WhatsAppIcon className="size-5" /> {BRAND.whatsappDisplay}
            </a>
            <a
              href={BRAND.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-bold ring-2 ring-cream/40 transition hover:bg-cream/10"
            >
              <InstagramIcon className="size-5" /> @{BRAND.instagram}
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="rounded-[2rem] bg-cream p-8 text-ink shadow-2xl sm:p-10">
            <h3 className="font-display text-3xl font-bold">Horário de funcionamento</h3>
            <ul className="mt-6 divide-y divide-dashed divide-terracotta/25">
              {BRAND.hours.map((h) => (
                <li key={h.days} className="flex items-baseline justify-between py-4">
                  <span className="text-lg font-semibold">{h.days}</span>
                  <span className="font-display text-2xl font-bold text-terracotta">{h.time}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between py-4 text-ink/45">
                <span className="text-lg font-semibold">Domingo e segunda</span>
                <span className="font-display text-2xl font-bold">Fechado</span>
              </li>
            </ul>
            <p className="mt-4 rounded-2xl bg-amber/20 px-4 py-3 text-sm font-semibold">
              Alguns pedidos saem na hora, outros são por encomenda — chama no WhatsApp para confirmar.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-terracotta-dark px-4 py-10 text-cream/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-3">
          <Image src="/img/logo.webp" alt="" width={44} height={44} />
          <div>
            <p className="font-display text-lg font-bold text-cream">Assados da Evy</p>
            <p className="font-script text-lg leading-none">1 cadin de tudo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid size-10 place-items-center rounded-full bg-cream/10 transition hover:bg-cream/20">
            <InstagramIcon className="size-5 text-cream" />
          </a>
          <a href={waLink()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid size-10 place-items-center rounded-full bg-cream/10 transition hover:bg-cream/20">
            <WhatsAppIcon className="size-5 text-cream" />
          </a>
        </div>
        <p className="text-sm">© Assados da Evy · {BRAND.city}</p>
      </div>
    </footer>
  );
}

export function FloatingWhatsApp() {
  return (
    <motion.a
      href={waLink("Olá! Vim pelo site e gostaria de fazer um pedido 😊")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 2, type: "spring", bounce: 0.5 }}
      whileHover={{ scale: 1.08 }}
      className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-xl shadow-black/20"
    >
      <WhatsAppIcon className="size-7" />
    </motion.a>
  );
}
