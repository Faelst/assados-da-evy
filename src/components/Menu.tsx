"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ASSADINHO_FLAVORS, CATEGORIES, MENU, type CategoryId } from "@/lib/data";
import { EASE, Reveal } from "./Reveal";

/** Cardápio digital — propositalmente sem preços (eles aparecem só no orçamento). */
export function Menu() {
  const [active, setActive] = useState<CategoryId>("individual");
  const category = CATEGORIES.find((c) => c.id === active)!;
  const items = MENU.filter((m) => m.category === active);

  return (
    <section id="cardapio" className="bg-[#fff4ee] px-4 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-terracotta">Cardápio digital</p>
          <h2 className="mt-3 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-none tracking-tight">
            Escolha o seu favorito.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-12 flex justify-center">
          <div role="tablist" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-cream-deep/70 p-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={active === c.id}
                onClick={() => setActive(c.id)}
                className="relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold sm:px-6 sm:text-base"
              >
                {active === c.id && (
                  <motion.span
                    layoutId="menu-pill"
                    className="absolute inset-0 rounded-full bg-terracotta shadow-lg shadow-terracotta/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className={`relative transition-colors ${active === c.id ? "text-cream" : "text-ink/70"}`}>{c.title}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-12"
          >
            <p className="text-center text-base font-semibold text-tomato">{category.subtitle}</p>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                  whileHover={{ y: -6 }}
                  className="group rounded-3xl border border-terracotta/10 bg-white/70 p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-terracotta/10"
                >
                  <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-amber/25 text-xl transition group-hover:rotate-6 group-hover:bg-amber/40">
                    {active === "doce" ? "🍫" : active === "pizza" ? "🍕" : active === "assadinhos" ? "🥐" : "🥟"}
                  </div>
                  <h3 className="font-display text-2xl font-bold">{item.name}</h3>
                  <p className="mt-2 leading-relaxed text-ink/70">
                    {item.flavors ? `Escolha até ${item.flavors} sabores diferentes.` : item.description}
                  </p>
                </motion.li>
              ))}
            </ul>

            {active === "assadinhos" && (
              <div className="mt-10 rounded-3xl bg-terracotta p-6 text-cream sm:p-8">
                <p className="font-display text-xl font-bold">Sabores disponíveis</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ASSADINHO_FLAVORS.map((f) => (
                    <span key={f} className="rounded-full bg-cream/15 px-4 py-1.5 text-sm font-semibold">
                      {f}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-cream/80">Maiores quantidades? A combinar.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <Reveal className="mt-14 text-center">
          <a
            href="#orcamento"
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-7 py-3.5 font-bold text-cream shadow-lg shadow-terracotta/25 transition hover:bg-terracotta-dark"
          >
            Ver valores e montar orçamento →
          </a>
        </Reveal>
      </div>
    </section>
  );
}
