import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { dateColumn, todayIn } from "@/server/domain/time";
import { formatCents } from "@/lib/phone";
import { PageHeader } from "@/components/admin/PageHeader";
import { StockAdjust } from "@/components/admin/StockAdjust";
import { closeMenuAction, saveMenuAction, togglePauseAction } from "./actions";

export default async function CardapioDoDia({ searchParams }: PageProps<"/admin/cardapio-do-dia">) {
  await requireSection("cardapio-do-dia");
  const store = await getStore();
  const sp = await searchParams;
  const today = todayIn(store.timezone);
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today;
  const [products, menu] = await Promise.all([
    db.product.findMany({ where: { storeId: store.id, active: true, saleModes: { has: "READY" } }, orderBy: { sortOrder: "asc" } }),
    db.dailyMenu.findUnique({
      where: { storeId_date: { storeId: store.id, date: dateColumn(date) } },
      include: { items: { include: { movements: { orderBy: { createdAt: "desc" }, take: 3 } } } },
    }),
  ]);
  const itemOf = new Map(menu?.items.map((i) => [i.productId, i]) ?? []);

  return (
    <>
      <PageHeader
        title="Pronta entrega"
        subtitle={`Cardápio de ${date.split("-").reverse().join("/")}: o que já está pronto e quanto tem. ${menu?.status === "CLOSED" ? "Encerrado." : ""}`}
        actions={
          <form className="flex gap-2">
            <input type="date" name="data" defaultValue={date} className="input w-40" />
            <button className="btn-secondary">Ver</button>
          </form>
        }
      />

      <form action={saveMenuAction} className="card mb-4 space-y-3">
        <input type="hidden" name="date" value={date} />
        <h2 className="font-display text-lg font-bold">Quantidade disponível agora</h2>
        <p className="text-sm text-ink/60">Deixe em branco o que não tem hoje. Ao salvar, o estoque passa a ser exatamente o número digitado.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {products.map((p) => {
            const item = itemOf.get(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl p-2 ring-1 ring-terracotta/10">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="text-xs text-ink/60">{formatCents(p.priceCents)}{item && ` · inicial ${item.qtyInitial}`}</span>
                </span>
                <input type="number" min={0} name={`qty:${p.id}`} defaultValue={item?.qtyAvailable ?? ""} className="input w-24 py-1.5 text-right" aria-label={`Quantidade de ${p.name}`} />
              </li>
            );
          })}
        </ul>
        <button className="btn-primary">Salvar cardápio do dia</button>
      </form>

      {menu && menu.items.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-display text-lg font-bold">Movimentações</h2>
          {menu.items.map((i) => {
            const p = products.find((x) => x.id === i.productId);
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl p-2 ring-1 ring-terracotta/10">
                <span className="min-w-32 flex-1 font-semibold">{p?.name ?? "Produto"}</span>
                <span className={`chip ${i.qtyAvailable === 0 ? "bg-tomato/15 text-tomato" : "bg-emerald-100 text-emerald-800"}`}>
                  {i.qtyAvailable === 0 ? "Esgotado" : `${i.qtyAvailable} disponíveis`}
                </span>
                {i.paused && <span className="chip bg-ink/10 text-ink/60">Pausado</span>}
                <form action={togglePauseAction}>
                  <input type="hidden" name="itemId" value={i.id} />
                  <input type="hidden" name="paused" value={i.paused ? "0" : "1"} />
                  <button className="btn-ghost">{i.paused ? "Retomar venda" : "Pausar"}</button>
                </form>
                <StockAdjust itemId={i.id} />
                <p className="w-full text-xs text-ink/50">
                  {i.movements.map((m) => `${m.type === "IN" ? "+" : "-"}${m.qty} ${m.reason ?? m.type.toLowerCase()}`).join(" · ")}
                </p>
              </div>
            );
          })}
          {menu.status === "OPEN" && (
            <form action={closeMenuAction} className="pt-2">
              <input type="hidden" name="date" value={date} />
              <button className="btn-secondary">Encerrar pronta entrega do dia</button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
