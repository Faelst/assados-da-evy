import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Flame } from "lucide-react";
import { getStore } from "@/server/store";
import { getTodayMenu } from "@/server/services/stock";
import { getStoreStatus } from "@/server/services/calendar";
import { StoreStatusPill } from "@/components/loja/StoreStatusPill";
import { BRAND } from "@/lib/data";

export default async function Home() {
  const store = await getStore();
  const [menu, status] = await Promise.all([getTodayMenu(store.id), getStoreStatus(store.id)]);
  const readyCount = menu?.items.filter((i) => i.qtyAvailable > 0 && !i.paused).length ?? 0;
  const readyOn = !!menu?.open && readyCount > 0;

  return (
    <div className="space-y-8">
      <section className="grain relative overflow-hidden rounded-[2rem] bg-terracotta px-6 py-10 text-cream sm:px-10 sm:py-14">
        <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
          <Image src="/img/logo.webp" alt={BRAND.name} width={120} height={120} className="size-24 rounded-full bg-cream p-1 sm:size-32" priority />
          <div>
            <p className="font-script text-2xl text-amber">{BRAND.tagline}</p>
            <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">Assados quentinhos, do jeito da Evy</h1>
            <p className="mt-2 max-w-xl text-cream/85">
              Peça o que já está pronto hoje ou encomende para o dia e horário que você quiser.
            </p>
            <div className="mt-3 sm:hidden">
              <StoreStatusPill />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {readyOn ? (
          <Link href="/pronta-entrega" className="card group flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-lg">
            <span className="grid size-12 place-items-center rounded-2xl bg-amber/30 text-terracotta">
              <Flame />
            </span>
            <h2 className="font-display text-2xl font-bold text-terracotta-dark">Pronta entrega</h2>
            <p className="text-ink/70">
              {readyCount} {readyCount === 1 ? "salgado saiu" : "salgados saíram"} do forno hoje. Retire ou receba em até{" "}
              {store.readyEtaMinutes} min.
            </p>
            <span className="btn-primary mt-auto self-start">Ver o que tem hoje</span>
          </Link>
        ) : (
          <div className="card flex flex-col gap-3 opacity-80">
            <span className="grid size-12 place-items-center rounded-2xl bg-ink/10 text-ink/50">
              <Flame />
            </span>
            <h2 className="font-display text-2xl font-bold text-ink/70">Pronta entrega</h2>
            <p className="text-ink/60">
              {status.open ? "Ainda não temos salgados prontos hoje." : "A cozinha está fechada agora."} Que tal encomendar?
            </p>
          </div>
        )}

        <Link href="/encomendar" className="card group flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-lg">
          <span className="grid size-12 place-items-center rounded-2xl bg-terracotta/10 text-terracotta">
            <CalendarDays />
          </span>
          <h2 className="font-display text-2xl font-bold text-terracotta-dark">Encomendar</h2>
          <p className="text-ink/70">Escolha o dia, veja as receitas da fornada e o horário em que fica pronto.</p>
          <span className="btn-secondary mt-auto self-start">Escolher data</span>
        </Link>
      </section>
    </div>
  );
}
