"use client";

import Image from "next/image";
import { useActionState } from "react";
import { saveProductAction } from "@/app/admin/(painel)/receitas/actions";

export type ProductFormData = {
  id?: string;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  ready: boolean;
  scheduled: boolean;
  leadTimeHours: number;
  batchSize: number;
  batchDurationMin: number;
  productionUnits: number;
  active: boolean;
  imageUrl: string | null;
  variants: string;
};

export function ProductForm({ initial, categories }: { initial: ProductFormData; categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveProductAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <section className="card grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">Nome</span>
          <input name="name" required defaultValue={initial.name} className="input mt-1" />
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">Descrição</span>
          <textarea name="description" defaultValue={initial.description} className="input mt-1 min-h-20" maxLength={500} />
        </label>
        <label>
          <span className="text-sm font-semibold">Preço (R$)</span>
          <input name="price" required inputMode="decimal" defaultValue={initial.price} className="input mt-1" />
        </label>
        <label>
          <span className="text-sm font-semibold">Categoria</span>
          <select name="categoryId" defaultValue={initial.categoryId} className="input mt-1">
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-4 sm:col-span-2">
          {initial.imageUrl && <Image src={initial.imageUrl} alt="" width={72} height={72} className="size-18 rounded-2xl object-cover" />}
          <label className="flex-1">
            <span className="text-sm font-semibold">Foto {initial.imageUrl && <span className="font-normal text-ink/50">(envie outra para trocar)</span>}</span>
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input mt-1" />
          </label>
        </div>
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">Variações <span className="font-normal text-ink/50">(uma por linha: nome; acréscimo em R$. Ex.: Cheddar; 2)</span></span>
          <textarea name="variants" defaultValue={initial.variants} className="input mt-1 min-h-16" />
        </label>
      </section>

      <section className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">Venda e produção</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="ready" defaultChecked={initial.ready} className="accent-terracotta" /> Pronta entrega
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="scheduled" defaultChecked={initial.scheduled} className="accent-terracotta" /> Encomenda
        </label>
        <label>
          <span className="text-sm font-semibold">Unidades por fornada</span>
          <input type="number" name="batchSize" min={1} required defaultValue={initial.batchSize} className="input mt-1" />
        </label>
        <label>
          <span className="text-sm font-semibold">Tempo da fornada (minutos)</span>
          <input type="number" name="batchDurationMin" min={5} step={5} required defaultValue={initial.batchDurationMin} className="input mt-1" />
        </label>
        <label>
          <span className="text-sm font-semibold">Antecedência mínima (horas)</span>
          <input type="number" name="leadTimeHours" min={0} required defaultValue={initial.leadTimeHours} className="input mt-1" />
        </label>
        <label>
          <span className="text-sm font-semibold">Unidades da fornada que 1 item usa</span>
          <input type="number" name="productionUnits" min={1} required defaultValue={initial.productionUnits} className="input mt-1" />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="accent-terracotta" /> Ativa (aparece na loja)
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar receita"}</button>
        {state?.error && <p className="text-sm font-semibold text-tomato" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}
