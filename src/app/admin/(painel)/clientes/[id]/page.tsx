import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { anonymizeCustomer } from "@/server/services/settings";
import { formatCents, maskPhone } from "@/lib/phone";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";

async function anonymize(form: FormData) {
  "use server";
  const s = await requireSection("clientes");
  if (s.role !== "OWNER") return;
  await anonymizeCustomer(s.storeId, String(form.get("id")));
  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

export default async function Cliente({ params }: PageProps<"/admin/clientes/[id]">) {
  const s = await requireSection("clientes");
  const { id } = await params;
  const c = await db.customer.findFirst({
    where: { id, storeId: s.storeId },
    include: { addresses: true, orders: { orderBy: { createdAt: "desc" }, include: { items: true } } },
  });
  if (!c) notFound();
  const total = c.orders.filter((o) => o.status !== "CANCELLED").reduce((sum, o) => sum + o.totalCents, 0);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/clientes" className="btn-ghost -ml-3"><ArrowLeft className="size-4" /> Clientes</Link>
      <PageHeader title={c.name} subtitle={`${/^\d+$/.test(c.phone) ? maskPhone(c.phone) : ""}${c.email ? ` · ${c.email}` : ""} · ${c.orders.length} pedido(s) · ${formatCents(total)}`} />
      {c.addresses.map((a) => (
        <p key={a.id} className="card text-sm">{a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ""} · {a.district} · {a.city}/{a.state}</p>
      ))}
      <ul className="space-y-2">
        {c.orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/pedidos/${o.id}`} className="card flex flex-wrap items-center gap-3 p-3 hover:shadow-md">
              <span className="font-bold text-terracotta">{o.code}</span>
              <span className="flex-1 truncate text-sm">{o.items.map((i) => `${i.qty}× ${i.nameSnapshot}`).join(", ")}</span>
              <span className="font-semibold">{formatCents(o.totalCents)}</span>
              <StatusBadge status={o.status} />
            </Link>
          </li>
        ))}
      </ul>
      {s.role === "OWNER" && (
        <form action={anonymize} className="card space-y-2 bg-tomato/5">
          <input type="hidden" name="id" value={c.id} />
          <p className="text-sm">
            <strong>Excluir dados pessoais (LGPD).</strong> Remove nome, telefone, e-mail e endereços deste cliente. Os pedidos continuam no histórico, sem os dados pessoais. Não dá para desfazer.
          </p>
          <button className="btn-secondary text-tomato">Excluir dados do cliente</button>
        </form>
      )}
    </div>
  );
}
