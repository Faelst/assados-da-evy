import "server-only";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
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

export async function getSession(): Promise<Session | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Exige usuário logado com acesso à seção; senão manda para o login ou 403. */
export async function requireSection(section: Section): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (!can(s.role, section)) forbidden();
  return s;
}
