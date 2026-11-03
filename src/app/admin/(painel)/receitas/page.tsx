import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { formatCents } from "@/lib/phone";
import { PageHeader } from "@/components/admin/PageHeader";

export default async function Receitas() {
  await requireSection("receitas");
  const store = await getStore();
  const products = await db.product.findMany({ where: { storeId: store.id }, include: { category: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader title="Receitas" subtitle="Produtos da loja e como cada um é produzido." actions={<Link href="/admin/receitas/novo" className="btn-primary"><Plus className="size-4" /> Nova receita</Link>} />
      <ul className="grid gap-2 md:grid-cols-2">
        {products.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/receitas/${p.id}`} className={`card flex items-center gap-3 p-3 transition hover:shadow-md ${p.active ? "" : "opacity-50"}`}>
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                <Image src={p.imageUrl ?? "/img/logo.webp"} alt="" fill sizes="56px" className={p.imageUrl ? "object-cover" : "object-contain p-2"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-ink/60">
                  {p.category?.name ?? "Sem categoria"} · {p.saleModes.map((m) => (m === "READY" ? "pronta entrega" : "encomenda")).join(" + ")}
                </span>
                <span className="block text-xs text-ink/60">Fornada: {p.batchSize} un / {p.batchDurationMin} min · {p.leadTimeHours}h antecedência</span>
              </span>
              <span className="font-bold text-terracotta">{formatCents(p.priceCents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
