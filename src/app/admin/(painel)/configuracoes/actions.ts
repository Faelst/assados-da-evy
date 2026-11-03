"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth";
import { db } from "@/server/db";
import { regenerateFuture } from "@/server/services/batches";
import { onlyDigits } from "@/lib/phone";

const int = (v: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function saveStoreAction(_: { error?: string; ok?: string } | undefined, form: FormData) {
  const s = await requireSection("configuracoes");
  const name = String(form.get("name") ?? "").trim();
  const whatsapp = onlyDigits(String(form.get("whatsapp") ?? ""));
  if (name.length < 2 || whatsapp.length < 10) return { error: "Informe o nome da loja e um WhatsApp com DDD." };
  await db.store.update({
    where: { id: s.storeId },
    data: {
      name,
      whatsapp: whatsapp.startsWith("55") ? whatsapp : `55${whatsapp}`,
      parallelBatches: int(form.get("parallelBatches"), 1, 20, 1),
      bookingWindowDays: int(form.get("bookingWindowDays"), 1, 180, 30),
      holdMinutes: int(form.get("holdMinutes"), 2, 60, 10),
    },
  });
  await regenerateFuture(s.storeId);
  revalidatePath("/", "layout");
  return { ok: "Configurações salvas." };
}

export async function createUserAction(_: { error?: string; ok?: string } | undefined, form: FormData) {
  const s = await requireSection("configuracoes");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "");
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !["OWNER", "ATTENDANT", "KITCHEN"].includes(role)) {
    return { error: "Preencha nome, e-mail válido, senha com 8+ caracteres e papel." };
  }
  if (await db.user.findUnique({ where: { email } })) return { error: "Já existe um usuário com esse e-mail." };
  await db.user.create({
    data: { storeId: s.storeId, name, email, passwordHash: await bcrypt.hash(password, 10), role: role as "OWNER" | "ATTENDANT" | "KITCHEN" },
  });
  revalidatePath("/admin/configuracoes");
  return { ok: `Usuário ${name} criado.` };
}

export async function toggleUserAction(form: FormData) {
  const s = await requireSection("configuracoes");
  const id = String(form.get("id"));
  if (id === s.userId) return;
  await db.user.updateMany({ where: { id, storeId: s.storeId }, data: { active: form.get("active") === "1" } });
  revalidatePath("/admin/configuracoes");
}

export async function changePasswordAction(_: { error?: string; ok?: string } | undefined, form: FormData) {
  const s = await requireSection("configuracoes");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter 8 caracteres ou mais." };
  await db.user.update({ where: { id: s.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { ok: "Senha alterada." };
}
