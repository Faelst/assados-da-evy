"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { adjustStock, closeDailyMenu, setPaused, StockError, upsertDailyMenu } from "@/server/services/stock";

async function ownsItem(storeId: string, itemId: string) {
  return !!(await db.dailyMenuItem.findFirst({ where: { id: itemId, dailyMenu: { storeId } } }));
}

function refresh() {
  revalidatePath("/admin/cardapio-do-dia");
  revalidatePath("/pronta-entrega");
  revalidatePath("/");
}

export async function saveMenuAction(form: FormData) {
  const s = await requireSection("cardapio-do-dia");
  const date = String(form.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const valid = new Set((await db.product.findMany({ where: { storeId: s.storeId }, select: { id: true } })).map((p) => p.id));
  const items: { productId: string; qty: number }[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("qty:")) continue;
    const productId = k.slice(4);
    const raw = String(v).trim();
    if (raw === "" || !valid.has(productId)) continue;
    const qty = Math.max(0, Math.floor(Number(raw)));
    if (Number.isFinite(qty)) items.push({ productId, qty });
  }
  await upsertDailyMenu(s.storeId, date, items, s.userId);
  refresh();
}

export async function adjustAction(_: { error?: string } | undefined, form: FormData) {
  const s = await requireSection("cardapio-do-dia");
  const itemId = String(form.get("itemId"));
  const type = String(form.get("type")) as "IN" | "OUT" | "LOSS";
  const qty = Math.floor(Number(form.get("qty")));
  const reason = String(form.get("reason") ?? "").trim();
  if (!(await ownsItem(s.storeId, itemId)) || !["IN", "OUT", "LOSS"].includes(type) || !(qty > 0)) return { error: "Quantidade inválida." };
  if (!reason) return { error: "Informe o motivo." };
  try {
    await adjustStock(itemId, type === "IN" ? qty : -qty, type, reason, s.userId);
  } catch (e) {
    if (e instanceof StockError) return { error: "Não há essa quantidade em estoque." };
    throw e;
  }
  refresh();
  return {};
}

export async function togglePauseAction(form: FormData) {
  const s = await requireSection("cardapio-do-dia");
  const itemId = String(form.get("itemId"));
  if (!(await ownsItem(s.storeId, itemId))) return;
  await setPaused(itemId, form.get("paused") === "1");
  refresh();
}

export async function closeMenuAction(form: FormData) {
  const s = await requireSection("cardapio-do-dia");
  await closeDailyMenu(s.storeId, String(form.get("date")));
  refresh();
}
