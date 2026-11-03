"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarClock, CalendarDays, CalendarX, ChefHat, ClipboardList, Clock, CookingPot, CreditCard, LayoutDashboard,
  ListChecks, LogOut, Menu, Settings, ShoppingBasket, Truck, Users, X,
} from "lucide-react";
import { logoutAction } from "@/app/admin/login/actions";

const ITEMS = [
  { section: "dashboard", href: "/admin", label: "Início", icon: LayoutDashboard },
  { section: "pedidos", href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { section: "agenda", href: "/admin/agenda", label: "Agenda da semana", icon: CalendarDays },
  { section: "producao", href: "/admin/producao", label: "Produção do dia", icon: ChefHat },
  { section: "cardapio-do-dia", href: "/admin/cardapio-do-dia", label: "Pronta entrega", icon: ShoppingBasket },
  { section: "receitas", href: "/admin/receitas", label: "Receitas", icon: CookingPot },
  { section: "plano-de-fornadas", href: "/admin/plano-de-fornadas", label: "Plano de fornadas", icon: ListChecks },
  { section: "fornadas", href: "/admin/fornadas", label: "Fornadas por data", icon: CalendarClock },
  { section: "horarios", href: "/admin/horarios", label: "Horários", icon: Clock },
  { section: "excecoes", href: "/admin/excecoes", label: "Feriados e exceções", icon: CalendarX },
  { section: "entrega", href: "/admin/entrega", label: "Entrega", icon: Truck },
  { section: "pagamento", href: "/admin/pagamento", label: "Pagamento", icon: CreditCard },
  { section: "clientes", href: "/admin/clientes", label: "Clientes", icon: Users },
  { section: "configuracoes", href: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AdminNav({ allowed, userName, role }: { allowed: string[]; userName: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => allowed.includes(i.section));
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const list = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link href="/admin" className="mb-3 flex items-center gap-2 px-2" onClick={() => setOpen(false)}>
        <Image src="/img/logo.webp" alt="" width={36} height={36} className="size-9" />
        <span className="font-display text-lg font-bold text-terracotta">Painel da Evy</span>
      </Link>
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            isActive(href) ? "bg-terracotta text-cream" : "text-ink/75 hover:bg-terracotta/10"
          }`}
        >
          <Icon className="size-4" /> {label}
        </Link>
      ))}
      <div className="mt-auto border-t border-terracotta/10 px-2 pt-3 text-xs text-ink/60">
        <p className="font-semibold text-ink">{userName}</p>
        <p>{role}</p>
        <div className="mt-2 flex gap-1">
          <Link href="/" target="_blank" className="btn-ghost px-2">Ver loja</Link>
          <form action={logoutAction}>
            <button className="btn-ghost px-2"><LogOut className="size-4" /> Sair</button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <div className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b border-terracotta/10 bg-cream/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="grid size-10 place-items-center rounded-full hover:bg-terracotta/10">
          <Menu />
        </button>
        <span className="font-display font-bold text-terracotta">Painel da Evy</span>
        <span className="size-10" />
      </div>
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 border-r border-terracotta/10 bg-white lg:block">{list}</aside>
      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full hover:bg-terracotta/10">
              <X className="size-5" />
            </button>
            {list}
          </aside>
        </div>
      )}
    </>
  );
}
