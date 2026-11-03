import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CartProvider } from "@/components/loja/cart";
import { CartButton } from "@/components/loja/CartButton";
import { StoreStatusPill } from "@/components/loja/StoreStatusPill";
import { WhatsAppIcon } from "@/components/icons";
import { BRAND, waLink } from "@/lib/data";

export default function LojaLayout({ children }: LayoutProps<"/">) {
  return (
    <CartProvider>
      <header className="sticky top-0 z-40 border-b border-terracotta/10 bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Image src="/img/logo.webp" alt="" width={40} height={40} className="size-10 shrink-0" priority />
            <span className="truncate font-display text-lg font-bold text-terracotta">{BRAND.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block">
              <Suspense>
                <StoreStatusPill />
              </Suspense>
            </span>
            <CartButton />
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[70dvh] max-w-5xl px-4 pb-24 pt-6">
        <Suspense fallback={<p className="py-20 text-center text-ink/60">Carregando…</p>}>{children}</Suspense>
      </main>
      <footer className="border-t border-terracotta/10 bg-cream-deep/40">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-8 text-center text-sm text-ink/70 sm:flex-row sm:justify-between sm:text-left">
          <p>
            <strong className="font-display text-terracotta">{BRAND.name}</strong> · {BRAND.city} · {BRAND.tagline}
          </p>
          <a href={waLink("Olá! Vim pelo site 😊")} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            <WhatsAppIcon className="size-4" /> {BRAND.whatsappDisplay}
          </a>
        </div>
      </footer>
    </CartProvider>
  );
}
