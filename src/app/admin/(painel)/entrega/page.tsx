import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { formatCents } from "@/lib/phone";
import { PageHeader } from "@/components/admin/PageHeader";
import { PricingForm } from "@/components/admin/PricingForm";
import { addZoneAction, removeZoneAction, saveDeliverySettingsAction } from "./actions";

export default async function Entrega() {
  await requireSection("entrega");
  const store = await getStore();
  const zones = await db.deliveryZone.findMany({ where: { storeId: store.id }, orderBy: { district: "asc" } });
  return (
    <>
      <PageHeader title="Entrega e retirada" />
      <form action={saveDeliverySettingsAction} className="card mb-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="pickupEnabled" defaultChecked={store.pickupEnabled} className="accent-terracotta" /> Aceita retirada na loja</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="deliveryEnabled" defaultChecked={store.deliveryEnabled} className="accent-terracotta" /> Faz entrega</label>
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">Endereço de retirada</span>
          <input name="pickupAddress" defaultValue={store.pickupAddress ?? ""} className="input mt-1" />
        </label>
        <label>
          <span className="text-sm font-semibold">Pedido mínimo (R$)</span>
          <input name="minOrder" inputMode="decimal" defaultValue={(store.minOrderCents / 100).toFixed(2).replace(".", ",")} className="input mt-1" />
        </label>
        <label>
          <span className="text-sm font-semibold">Prazo da pronta entrega (minutos)</span>
          <input type="number" name="readyEtaMinutes" min={5} defaultValue={store.readyEtaMinutes} className="input mt-1" />
        </label>
        <button className="btn-primary sm:col-span-2 sm:justify-self-start">Salvar</button>
      </form>
      <div className="mb-4">
        <PricingForm
          initial={{
            deliveryPricing: store.deliveryPricing,
            originAddress: store.originAddress ?? "",
            originLat: store.originLat,
            originLng: store.originLng,
            base: store.deliveryBaseCents,
            perKm: store.deliveryPerKmCents,
            perMinute: store.deliveryPerMinuteCents,
            minFee: store.deliveryMinFeeCents,
            serviceFee: store.deliveryServiceFeeCents,
            maxKm: store.deliveryMaxKm,
            surgeMultiplier: store.surgeMultiplier,
            surgeStart: store.surgeStart,
            surgeEnd: store.surgeEnd,
          }}
        />
      </div>
      <section className={`card space-y-3 ${store.deliveryPricing === "ZONES" ? "" : "opacity-70"}`}>
        <h2 className="font-display text-lg font-bold">Bairros atendidos e taxa {store.deliveryPricing !== "ZONES" && <span className="text-sm font-normal text-ink/50">(usado só no modo por bairro)</span>}</h2>
        <ul className="divide-y divide-terracotta/10">
          {zones.map((z) => (
            <li key={z.id} className="flex items-center justify-between py-2">
              <span className="font-semibold">{z.district}</span>
              <span className="flex items-center gap-3">
                {formatCents(z.feeCents)}
                <form action={removeZoneAction}>
                  <input type="hidden" name="id" value={z.id} />
                  <button className="btn-ghost text-tomato">Remover</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
        <form action={addZoneAction} className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1">
            <span className="text-sm font-semibold">Bairro</span>
            <input name="district" required className="input mt-1" />
          </label>
          <label>
            <span className="text-sm font-semibold">Taxa (R$)</span>
            <input name="fee" inputMode="decimal" required className="input mt-1 w-28" />
          </label>
          <button className="btn-secondary">Adicionar / atualizar</button>
        </form>
      </section>
    </>
  );
}
