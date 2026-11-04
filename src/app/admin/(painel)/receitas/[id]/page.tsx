import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { requireSection } from "@/server/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";

export default async function EditarReceita({ params }: PageProps<"/admin/receitas/[id]">) {
  const s = await requireSection("receitas");
  const { id } = await params;
  const categories = await db.category.findMany({ where: { storeId: s.storeId }, orderBy: { sortOrder: "asc" } });
  let initial: ProductFormData;
  if (id === "novo") {
    initial = {
      name: "", description: "", price: "", categoryId: "", ready: false, scheduled: true, leadTimeHours: 24,
      batchSize: 10, batchDurationMin: 60, productionUnits: 1, active: true, imageUrl: null, variants: "",
    };
  } else {
    const p = await db.product.findFirst({ where: { id, storeId: s.storeId }, include: { variants: true } });
    if (!p) notFound();
    initial = {
      id: p.id,
      name: p.name,
      description: p.description,
      price: (p.priceCents / 100).toFixed(2).replace(".", ","),
      categoryId: p.categoryId ?? "",
      ready: p.saleModes.includes("READY"),
      scheduled: p.saleModes.includes("SCHEDULED"),
      leadTimeHours: p.leadTimeHours,
      batchSize: p.batchSize,
      batchDurationMin: p.batchDurationMin,
      productionUnits: p.productionUnits,
      active: p.active,
      imageUrl: p.imageUrl,
      variants: p.variants.map((v) => `${v.name}; ${(v.priceDeltaCents / 100).toFixed(2).replace(".", ",")}`).join("\n"),
    };
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/receitas" className="btn-ghost -ml-3 mb-2"><ArrowLeft className="size-4" /> Receitas</Link>
      <PageHeader title={id === "novo" ? "Nova receita" : initial.name} />
      <ProductForm initial={initial} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
