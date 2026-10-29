"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Reveal } from "./Reveal";

const STATS = [
  { value: "600g", label: "de recheio e massa num único salgado individual, dependendo do sabor." },
  { value: "4", label: "pessoas bem servidas com uma pizza enrolada." },
  { value: "6", label: "sabores de assadinhos para montar o seu mix de festa." },
];

type PhotoProps = { src: string; alt: string; width: number; height: number; maxWidth: number; from: number; to: number };

/**
 * As fotos disponíveis têm baixa resolução: exibimos na proporção original, sem zoom,
 * e limitamos a largura para não ampliar além do que a imagem aguenta.
 */
function Photo({ src, alt, width, height, maxWidth, from, to }: PhotoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [from, to]);
  return (
    <div ref={ref} className="flex justify-center">
      <motion.div
        style={{ y, maxWidth }}
        className="w-full overflow-hidden rounded-[2rem] bg-cream-deep shadow-2xl shadow-terracotta/20 ring-8 ring-white/60"
      >
        <Image src={src} alt={alt} width={width} height={height} unoptimized className="block h-auto w-full" />
      </motion.div>
    </div>
  );
}

export function Highlights() {
  return (
    <section className="relative overflow-hidden px-4 py-28 sm:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="font-script text-3xl text-terracotta">feito pra ser dividido (ou não)</p>
          <h2 className="mt-2 font-display text-[clamp(2.4rem,6vw,5rem)] font-extrabold leading-[0.95] tracking-tight">
            Grande no tamanho.
            <br />
            <span className="text-warm-gradient">Maior ainda no sabor.</span>
          </h2>
        </Reveal>

        <div className="mt-20 grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <Photo src="/img/pizza-enrolada.png" alt="Salgado individual recheado com hambúrguer e cheddar derretido" width={364} height={630} maxWidth={320} from={-30} to={30} />
          <div className="space-y-12">
            {STATS.map((s, i) => (
              <Reveal key={s.value} delay={i * 0.12}>
                <p className="font-display text-[clamp(4rem,10vw,7.5rem)] font-extrabold leading-none text-warm-gradient">{s.value}</p>
                <p className="mt-2 max-w-sm text-lg font-medium text-ink/75">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-28 grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal className="order-2 md:order-1">
            <h3 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">
              Assadinhos que
              <br />
              <span className="text-terracotta">somem da mesa.</span>
            </h3>
            <p className="mt-5 max-w-md text-lg text-ink/75">
              Versão mini dos nossos assados, perfeita para aniversários, reuniões e coffee breaks. Pacotes de 30, 50 e 100
              unidades — e maiores quantidades a combinar.
            </p>
            <a
              href="#eventos"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-bold text-cream transition hover:bg-terracotta"
            >
              Ver opções para eventos →
            </a>
          </Reveal>
          <div className="order-1 md:order-2">
            <Photo src="/img/assadinhos.png" alt="Bandeja de assadinhos com gergelim" width={206} height={390} maxWidth={230} from={30} to={-30} />
          </div>
        </div>
      </div>
    </section>
  );
}
