import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { can, type Section } from "@/server/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { NewOrdersWatcher } from "@/components/admin/NewOrdersWatcher";

export const metadata = { title: "Painel — Assados da Evy", robots: { index: false } };

const SECTIONS: Section[] = [
  "dashboard", "pedidos", "agenda", "producao", "cardapio-do-dia", "receitas", "plano-de-fornadas",
  "fornadas", "horarios", "excecoes", "entrega", "pagamento", "clientes", "configuracoes",
];
const ROLE_LABEL = { OWNER: "Dono", ATTENDANT: "Atendente", KITCHEN: "Cozinha" } as const;

async function Nav() {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return <AdminNav allowed={SECTIONS.filter((x) => can(s.role, x))} userName={s.name} role={ROLE_LABEL[s.role]} />;
}

export default function PainelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-cream/60">
      <Suspense>
        <Nav />
        <NewOrdersWatcher />
      </Suspense>
      <div className="lg:pl-60">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Suspense fallback={<p className="py-20 text-center text-ink/60">Carregando…</p>}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
