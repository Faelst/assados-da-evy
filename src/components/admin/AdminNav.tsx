"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays, CalendarX, ChefHat, ChevronDown, ClipboardList, Clock, CookingPot, CreditCard, ExternalLink,
  LayoutDashboard, LogOut, Menu, MonitorPlay, Settings, ShoppingBasket, Store, Truck, Users, X, type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/admin/login/actions";

type Leaf = { section: string; href: string; label: string; icon: LucideIcon; also?: string[] };
type Group = { label: string; icon: LucideIcon; children: Leaf[] };

/** Menu do painel: itens soltos e grupos com submenu. Grupos com um só item visível viram link direto. */
const NAV: (Leaf | Group)[] = [
  { section: "dashboard", href: "/admin", label: "Início", icon: LayoutDashboard },
  {
    label: "Vendas",
    icon: ClipboardList,
    children: [
      { section: "pedidos", href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
      { section: "clientes", href: "/admin/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Produção",
    icon: ChefHat,
    children: [
      { section: "agenda", href: "/admin/agenda", label: "Agenda e fornadas", icon: CalendarDays, also: ["/admin/fornadas", "/admin/plano-de-fornadas"] },
      { section: "producao", href: "/admin/producao", label: "Produção do dia", icon: ChefHat },
      { section: "cardapio-do-dia", href: "/admin/cardapio-do-dia", label: "Pronta entrega", icon: ShoppingBasket },
      { section: "receitas", href: "/admin/receitas", label: "Receitas", icon: CookingPot },
    ],
  },
  {
    label: "Loja",
    icon: Store,
    children: [
      { section: "horarios", href: "/admin/horarios", label: "Horários", icon: Clock },
      { section: "excecoes", href: "/admin/excecoes", label: "Feriados e exceções", icon: CalendarX },
      { section: "entrega", href: "/admin/entrega", label: "Entrega", icon: Truck },
      { section: "pagamento", href: "/admin/pagamento", label: "Pagamento", icon: CreditCard },
    ],
  },
  { section: "configuracoes", href: "/admin/configuracoes", label: "Usuários e senha", icon: Settings },
];

const isGroup = (n: Leaf | Group): n is Group => "children" in n;

export function AdminNav({ allowed, userName, role }: { allowed: string[]; userName: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const kitchen = allowed.includes("cozinha");
  const isActive = (l: Leaf) =>
    l.href === "/admin" ? pathname === "/admin" : [l.href, ...(l.also ?? [])].some((p) => pathname.startsWith(p));
  const nav = NAV.flatMap((n): (Leaf | Group)[] => {
    if (!isGroup(n)) return allowed.includes(n.section) ? [n] : [];
    const children = n.children.filter((c) => allowed.includes(c.section));
    if (children.length === 0) return [];
    return children.length === 1 ? children : [{ ...n, children }];
  });

  const leaf = (l: Leaf, nested = false) => (
    <Link
      key={l.href}
      href={l.href}
      onClick={() => setOpen(false)}
      aria-current={isActive(l) ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${nested ? "py-1.5 pl-10" : "py-2"} ${
        isActive(l) ? "bg-terracotta text-cream" : "text-ink/75 hover:bg-terracotta/10"
      }`}
    >
      {!nested && <l.icon className="size-4" />} {l.label}
    </Link>
  );

  const list = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <Link href="/admin" className="mb-3 flex items-center gap-2 px-2" onClick={() => setOpen(false)}>
        <Image src="/img/logo.webp" alt="" width={36} height={36} className="size-9" />
        <span className="font-display text-lg font-bold text-terracotta">Painel da Evy</span>
      </Link>
      {kitchen && (
        <Link
          href="/admin/cozinha"
          target="_blank"
          onClick={() => setOpen(false)}
          title="Abre a tela da cozinha numa aba separada"
          className="mb-3 flex items-center gap-3 rounded-2xl bg-ink px-3 py-3 text-sm font-bold text-cream shadow-sm transition hover:bg-ink/85"
        >
          <span className="relative grid size-8 place-items-center rounded-xl bg-white/10">
            <MonitorPlay className="size-4" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-tomato ring-2 ring-ink" />
          </span>
          <span className="flex-1 leading-tight">
            Cozinha ao vivo
            <span className="block text-[11px] font-semibold text-cream/60">Abrir tela da cozinha</span>
          </span>
          <ExternalLink className="size-4 text-cream/60" />
        </Link>
      )}
      {nav.map((n) => {
        if (!isGroup(n)) return leaf(n);
        const hasActive = n.children.some(isActive);
        const expanded = toggled[n.label] ?? hasActive;
        return (
          <div key={n.label}>
            <button
              type="button"
              onClick={() => setToggled((t) => ({ ...t, [n.label]: !expanded }))}
              aria-expanded={expanded}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-terracotta/10 ${
                hasActive ? "text-terracotta-dark" : "text-ink/75"
              }`}
            >
              <n.icon className="size-4" />
              <span className="flex-1 text-left">{n.label}</span>
              <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && <div className="mt-0.5 space-y-0.5">{n.children.map((c) => leaf(c, true))}</div>}
          </div>
        );
      })}
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
