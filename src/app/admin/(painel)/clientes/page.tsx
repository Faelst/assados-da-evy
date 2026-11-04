import Link from "next/link";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { maskPhone } from "@/lib/phone";
import { PageHeader } from "@/components/admin/PageHeader";

export default async function Clientes({ searchParams }: PageProps<"/admin/clientes">) {
  await requireSection("clientes");
  const store = await getStore();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const customers = await db.customer.findMany({
    where: {
      storeId: store.id,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    },
    include: { _count: { select: { orders: true } }, orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Clientes" />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nome ou telefone" className="input max-w-sm" />
        <button className="btn-secondary">Buscar</button>
      </form>
      <ul className="card divide-y divide-terracotta/10 p-0">
        {customers.length === 0 && <li className="p-4 text-sm text-ink/60">Nenhum cliente ainda.</li>}
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/clientes/${c.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-cream/60">
              <span className="min-w-40 flex-1 font-semibold">{c.name}</span>
              <span className="text-sm">{/^\d+$/.test(c.phone) ? maskPhone(c.phone) : "—"}</span>
              <span className="w-28 text-right text-sm text-ink/60">{c._count.orders} pedido(s)</span>
              <span className="w-28 text-right text-xs text-ink/50">
                {c.orders[0] ? `último ${c.orders[0].createdAt.toLocaleDateString("pt-BR", { timeZone: store.timezone })}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
