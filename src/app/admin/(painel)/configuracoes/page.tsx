import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { getStore } from "@/server/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { NewUserForm, PasswordForm, StoreForm } from "@/components/admin/SettingsForms";
import { toggleUserAction } from "./actions";

const ROLE = { OWNER: "Dono", ATTENDANT: "Atendente", KITCHEN: "Cozinha" } as const;

export default async function Configuracoes() {
  const s = await requireSection("configuracoes");
  const store = await getStore();
  const users = await db.user.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" />
      <StoreForm store={store} />
      <section className="card space-y-3">
        <h2 className="font-display text-lg font-bold">Usuários do painel</h2>
        <ul className="divide-y divide-terracotta/10">
          {users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-3 py-2 ${u.active ? "" : "opacity-50"}`}>
              <span className="min-w-32 flex-1 font-semibold">{u.name}</span>
              <span className="text-sm text-ink/70">{u.email}</span>
              <span className="chip bg-terracotta/10 text-terracotta">{ROLE[u.role]}</span>
              {u.id !== s.userId && (
                <form action={toggleUserAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                  <button className="btn-ghost">{u.active ? "Desativar" : "Reativar"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <NewUserForm />
      </section>
      <section className="card space-y-2">
        <h2 className="font-display text-lg font-bold">Minha senha</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
