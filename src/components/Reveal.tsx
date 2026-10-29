"use client";

import { motion, type HTMLMotionProps } from "motion/react";

export const EASE = [0.16, 1, 0.3, 1] as const;

type Props = HTMLMotionProps<"div"> & { delay?: number; y?: number };

/** Entrada suave ao rolar, no ritmo das páginas de produto da Apple. */
export function Reveal({ delay = 0, y = 40, children, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 1, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
