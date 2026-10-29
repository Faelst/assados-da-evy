"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

const TEXT =
  "Na cozinha da Evy, cada assado nasce de massa macia, recheio generoso e aquele cuidado de quem cozinha pra família. Ingredientes selecionados, feitos com carinho — sabor que você já conhece e ama.";

function Word({ word, range, progress }: { word: string; range: [number, number]; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return (
    <motion.span style={{ opacity }} className="mr-[0.25em] inline-block">
      {word}
    </motion.span>
  );
}

/** Texto que "acende" palavra a palavra conforme a rolagem. */
export function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = TEXT.split(" ");

  return (
    <section ref={ref} className="grain relative bg-terracotta-dark px-4 py-32 text-cream sm:py-44">
      <p className="mx-auto max-w-5xl font-display text-[clamp(1.8rem,4.6vw,3.8rem)] font-bold leading-[1.12] tracking-tight">
        {words.map((w, i) => (
          <Word key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />
        ))}
      </p>
    </section>
  );
}
