import Image from "next/image";
import type { ReactNode } from "react";
import { formatCents } from "@/lib/phone";

export function ProductCard({
  name,
  description,
  priceCents,
  imageUrl,
  badge,
  children,
}: {
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="card flex gap-4 p-4">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-cream-deep sm:size-28">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="112px" className="object-cover" />
        ) : (
          <Image src="/img/logo.webp" alt="" fill sizes="112px" className="object-contain p-3 opacity-60" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-lg font-bold leading-tight text-ink">{name}</h3>
          <span className="font-bold text-terracotta">{formatCents(priceCents)}</span>
        </div>
        {badge}
        <p className="line-clamp-2 text-sm text-ink/65">{description}</p>
        <div className="mt-auto pt-2">{children}</div>
      </div>
    </article>
  );
}
