import "server-only";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { db } from "./db";
import { can, readSession, signSession, SESSION_COOKIE, SESSION_DAYS, type Section, type Session } from "./session";

export async function startSession(s: Session) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Sessão válida de um usuário ainda ativo (papel e nome lidos do banco). */
export async function getSession(): Promise<Session | null> {
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const user = await db.user.findUnique({ where: { id: s.userId }, select: { active: true, role: true, name: true, storeId: true } });
  if (!user || !user.active) return null;
  return { userId: s.userId, storeId: user.storeId, role: user.role, name: user.name };
}

/** Exige usuário logado com acesso à seção; senão manda para o login ou 403. */
export async function requireSection(section: Section): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (!can(s.role, section)) forbidden();
  return s;
}
