import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { getStore } from "@/server/store";
import { PageHeader } from "@/components/admin/PageHeader";

const METHODS = [
  { id: "PIX", label: "Pix (chave exibida para o cliente)" },
  { id: "CASH", label: "Dinheiro (com troco)" },
  { id: "CARD", label: "Cartão na entrega/retirada" },
] as const;

async function savePayment(form: FormData) {
  "use server";
  const s = await requireSection("pagamento");
  const methods = METHODS.map((m) => m.id).filter((id) => form.get(id) === "on");
  if (methods.length === 0) return;
  await db.store.update({ where: { id: s.storeId }, data: { paymentMethods: methods, pixKey: String(form.get("pixKey") ?? "").trim() || null } });
  revalidatePath("/", "layout");
}

export default async function Pagamento() {
  await requireSection("pagamento");
  const store = await getStore();
  return (
    <>
      <PageHeader title="Pagamento" subtitle="Nenhuma cobrança é feita pelo site: o cliente escolhe a forma e paga na entrega, na retirada ou por Pix." />
      <form action={savePayment} className="card max-w-xl space-y-3">
        {METHODS.map((m) => (
          <label key={m.id} className="flex items-center gap-2">
            <input type="checkbox" name={m.id} defaultChecked={store.paymentMethods.includes(m.id)} className="accent-terracotta" /> {m.label}
          </label>
        ))}
        <label className="block">
          <span className="text-sm font-semibold">Chave Pix</span>
          <input name="pixKey" defaultValue={store.pixKey ?? ""} className="input mt-1" />
        </label>
        <p className="text-xs text-ink/60">Mantenha pelo menos uma forma marcada.</p>
        <button className="btn-primary">Salvar</button>
      </form>
    </>
  );
}
