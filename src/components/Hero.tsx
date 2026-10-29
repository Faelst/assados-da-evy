"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { EASE } from "./Reveal";

const HEADLINE = ["Sabor,", "qualidade", "e", "muito", "carinho", "em", "cada", "mordida."];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // Fase 1: título sobe e some; logo cresce até o centro.
  const titleY = useTransform(p, [0, 0.3], [0, -120]);
  const titleOpacity = useTransform(p, [0, 0.25], [1, 0]);
  const logoScale = useTransform(p, [0, 0.35, 0.6], [1, 1.35, 0.55]);
  const logoY = useTransform(p, [0, 0.35, 0.6], ["0vh", "-6vh", "-22vh"]);
  const logoRotate = useTransform(p, [0, 0.6], [0, -12]);

  // Fase 2: o terracota da logo "transborda" e toma a tela.
  const fill = useTransform(p, [0.3, 0.6], ["circle(0% at 50% 50%)", "circle(150% at 50% 50%)"]);

  // Fase 3: o slogan aparece.
  const sloganOpacity = useTransform(p, [0.58, 0.72], [0, 1]);
  const sloganScale = useTransform(p, [0.58, 0.85], [1.4, 1]);
  const subOpacity = useTransform(p, [0.72, 0.85], [0, 1]);
  const hintOpacity = useTransform(p, [0, 0.08], [1, 0]);

  return (
    <section id="top" ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 grid h-svh place-items-center overflow-hidden">
        {/* brilho quente de fundo */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[90vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(248,169,77,0.35),transparent_60%)]" />

        <motion.div
          style={{ clipPath: fill }}
          className="grain absolute inset-0 bg-[radial-gradient(ellipse_at_top,#b85a39,#a44f31_45%,#7e3a22)]"
        />

        <motion.div style={{ y: titleY, opacity: titleOpacity }} className="absolute inset-x-0 top-[13svh] px-4 text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.3 }}
            className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-terracotta"
          >
            Assados artesanais · Jacareí/SP
          </motion.p>
          <h1 className="mx-auto max-w-4xl font-display text-[clamp(2.4rem,7vw,5.5rem)] font-extrabold leading-[0.95] tracking-tight">
            {HEADLINE.map((w, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.45 + i * 0.07 }}
                className={`mr-[0.22em] inline-block ${i >= 4 ? "text-warm-gradient" : ""}`}
              >
                {w}
              </motion.span>
            ))}
          </h1>
        </motion.div>

        <motion.div
          style={{ scale: logoScale, y: logoY, rotate: logoRotate }}
          className="relative z-10 mt-[22svh] w-[min(62vw,340px)]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: 20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.6 }}
          >
            <Image
              src="/img/logo.webp"
              alt="Logo Assados da Evy — 1 cadin de tudo"
              width={1200}
              height={1200}
              priority
              className="h-auto w-full drop-shadow-[0_30px_60px_rgba(126,58,34,0.45)]"
            />
          </motion.div>
        </motion.div>

        <div className="absolute inset-x-0 bottom-[12svh] z-20 px-4 text-center text-cream">
          <motion.p
            style={{ opacity: sloganOpacity, scale: sloganScale }}
            className="font-script text-[clamp(3.5rem,12vw,9rem)] font-bold leading-none"
          >
            1 cadin de tudo
          </motion.p>
          <motion.p style={{ opacity: subOpacity }} className="mx-auto mt-4 max-w-xl text-lg font-medium text-cream/85 sm:text-xl">
            Salgados assados recheados até a borda, pizza enrolada e assadinhos para deixar qualquer encontro mais gostoso.
          </motion.p>
        </div>

        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold uppercase tracking-widest text-terracotta/70"
        >
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="block"
          >
            Role para descobrir ↓
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}
