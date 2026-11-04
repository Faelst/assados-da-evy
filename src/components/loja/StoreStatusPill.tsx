import { getStore } from "@/server/store";
import { getStoreStatus } from "@/server/services/calendar";

export async function StoreStatusPill() {
  const store = await getStore();
  const s = await getStoreStatus(store.id);
  const closesAt = s.shifts.find((sh) => sh.opensAt <= s.now && s.now < sh.closesAt)?.closesAt;
  const nextOpen = s.shifts.find((sh) => sh.opensAt > s.now)?.opensAt;
  return s.open ? (
    <span className="chip bg-emerald-100 text-emerald-800">
      <span className="size-2 rounded-full bg-emerald-500" /> Aberto agora{closesAt ? ` · até ${closesAt}` : ""}
    </span>
  ) : (
    <span className="chip bg-ink/10 text-ink/70">
      <span className="size-2 rounded-full bg-ink/40" /> Fechado agora{nextOpen ? ` · abre às ${nextOpen}` : ""}
    </span>
  );
}
