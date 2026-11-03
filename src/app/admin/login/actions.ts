"use server";

import { redirect } from "next/navigation";
import { startSession, endSession } from "@/server/auth";
import { verifyCredentials } from "@/server/session";

export async function loginAction(_: { error?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const session = await verifyCredentials(email, password);
  if (!session) return { error: "E-mail ou senha incorretos." };
  await startSession(session);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}
