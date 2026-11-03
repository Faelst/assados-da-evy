"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { regenerateFuture } from "@/server/services/batches";

const MAX_IMAGE = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const schema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().max(500),
  price: z.string().transform((v) => Math.round(Number(v.replace(",", ".")) * 100)).pipe(z.number().int().nonnegative()),
  categoryId: z.string().optional(),
  ready: z.boolean(),
  scheduled: z.boolean(),
  leadTimeHours: z.coerce.number().int().min(0).max(720),
  batchSize: z.coerce.number().int().min(1).max(10000),
  batchDurationMin: z.coerce.number().int().min(5).max(1440),
  productionUnits: z.coerce.number().int().min(1).max(10000),
  active: z.boolean(),
});

function parseVariants(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, delta] = l.split(";").map((s) => s.trim());
      return { name, priceDeltaCents: Math.round(Number((delta ?? "0").replace(",", ".")) * 100) || 0 };
    })
    .filter((v) => v.name);
}

async function saveImage(file: File | null): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;
  if (file.size > MAX_IMAGE || !EXT[file.type]) throw new Error("IMAGE");
  const name = `${randomBytes(8).toString("hex")}${EXT[file.type]}`;
  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/api/uploads/${name}`;
}

export async function saveProductAction(_: { error?: string } | undefined, form: FormData) {
  const s = await requireSection("receitas");
  const id = String(form.get("id") ?? "") || null;
  const parsed = schema.safeParse({
    name: form.get("name"),
    description: form.get("description") ?? "",
    price: String(form.get("price") ?? ""),
    categoryId: String(form.get("categoryId") ?? "") || undefined,
    ready: form.get("ready") === "on",
    scheduled: form.get("scheduled") === "on",
    leadTimeHours: form.get("leadTimeHours"),
    batchSize: form.get("batchSize"),
    batchDurationMin: form.get("batchDurationMin"),
    productionUnits: form.get("productionUnits"),
    active: form.get("active") === "on",
  });
  if (!parsed.success) return { error: "Confira os campos: nome, preço e números da fornada." };
  const v = parsed.data;
  if (!v.ready && !v.scheduled) return { error: "Escolha pelo menos um modo de venda." };
  if (v.categoryId && !(await db.category.findFirst({ where: { id: v.categoryId, storeId: s.storeId } }))) return { error: "Categoria inválida." };
  if (id && !(await db.product.findFirst({ where: { id, storeId: s.storeId } }))) return { error: "Receita não encontrada." };

  let imageUrl: string | undefined;
  try {
    imageUrl = await saveImage(form.get("image") as File | null);
  } catch {
    return { error: "A foto precisa ser JPG, PNG ou WEBP de até 5 MB." };
  }

  const data = {
    name: v.name,
    description: v.description,
    priceCents: v.price,
    categoryId: v.categoryId ?? null,
    saleModes: [...(v.ready ? (["READY"] as const) : []), ...(v.scheduled ? (["SCHEDULED"] as const) : [])],
    leadTimeHours: v.leadTimeHours,
    batchSize: v.batchSize,
    batchDurationMin: v.batchDurationMin,
    productionUnits: v.productionUnits,
    active: v.active,
    ...(imageUrl ? { imageUrl } : {}),
  };
  const variants = parseVariants(String(form.get("variants") ?? ""));

  const product = id
    ? await db.product.update({ where: { id }, data })
    : await db.product.create({ data: { ...data, storeId: s.storeId, sortOrder: await db.product.count({ where: { storeId: s.storeId } }) } });

  const existing = await db.productVariant.findMany({ where: { productId: product.id } });
  const keep = new Set<string>();
  for (const vr of variants) {
    const match = existing.find((e) => e.name === vr.name);
    if (match) {
      keep.add(match.id);
      if (match.priceDeltaCents !== vr.priceDeltaCents) await db.productVariant.update({ where: { id: match.id }, data: { priceDeltaCents: vr.priceDeltaCents } });
    } else await db.productVariant.create({ data: { productId: product.id, ...vr } });
  }
  await db.productVariant.deleteMany({ where: { productId: product.id, id: { notIn: [...keep] }, name: { notIn: variants.map((x) => x.name) } } });

  // capacidade/duração podem ter mudado: recria as fornadas futuras ainda vazias
  await db.productionBatch.deleteMany({
    where: { productId: product.id, usedUnits: 0, heldUnits: 0, manual: false, startsAt: { gt: new Date() } },
  });
  await regenerateFuture(s.storeId);
  revalidatePath("/", "layout");
  redirect("/admin/receitas");
}
