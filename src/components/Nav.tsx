"use client";

import Image from "next/image";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { BRAND, waLink } from "@/lib/data";
import { WhatsAppIcon } from "./icons";

const LINKS = [
  { href: "#cardapio", label: "Cardápio" },
  { href: "#eventos", label: "Eventos" },
  { href: "#orcamento", label: "Orçamento" },
  { href: "#contato", label: "Contato" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 40));

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        solid || open ? "bg-cream/75 backdrop-blur-xl border-b border-terracotta/10" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2" aria-label={BRAND.name}>
          <Image src="/img/logo.webp" alt="" width={36} height={36} className="size-9" priority />
          <span className="font-display text-lg font-bold text-terracotta">Assados da Evy</span>
        </a>

        <ul className="hidden items-center gap-7 text-sm font-semibold text-ink/80 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-terracotta">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={waLink("Olá! Vim pelo site e gostaria de fazer um pedido 😊")}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-full bg-terracotta px-4 py-1.5 text-sm font-bold text-cream transition hover:bg-terracotta-dark sm:flex"
          >
            <WhatsAppIcon className="size-4" /> Pedir agora
          </a>
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid size-9 place-items-center rounded-full md:hidden"
            aria-label="Abrir menu"
            aria-expanded={open}
          >
            <span className="relative block h-3 w-5">
              <span className={`absolute left-0 h-0.5 w-5 rounded bg-ink transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 h-0.5 w-5 rounded bg-ink transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
      </nav>

      {open && (
        <ul className="space-y-1 px-4 pb-4 md:hidden">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 font-display text-xl font-bold text-ink hover:bg-terracotta/10"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </motion.header>
  );
}
