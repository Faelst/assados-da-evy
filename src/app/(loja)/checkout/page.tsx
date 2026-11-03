import { db } from "@/server/db";
import { getStore } from "@/server/store";
import { CheckoutForm } from "@/components/loja/CheckoutForm";

export const metadata = { title: "Finalizar pedido — Assados da Evy" };

export default async function Checkout() {
  const store = await getStore();
  const zones = await db.deliveryZone.findMany({ where: { storeId: store.id }, orderBy: { district: "asc" } });
  return (
    <CheckoutForm
      store={{
        pickupEnabled: store.pickupEnabled,
        deliveryEnabled: store.deliveryEnabled,
        paymentMethods: store.paymentMethods,
        pixKey: store.pixKey,
        pickupAddress: store.pickupAddress,
        minOrderCents: store.minOrderCents,
        readyEtaMinutes: store.readyEtaMinutes,
      }}
      zones={zones.map((z) => ({ district: z.district, feeCents: z.feeCents }))}
    />
  );
}
