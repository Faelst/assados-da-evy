import "server-only";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import type { Role } from "@/server/domain/order-status";

export { signSession, readSession, SESSION_COOKIE, SESSION_DAYS, type Session } from "./session-token";
import type { Session } from "./session-token";

export async function verifyCredentials(email: string, password: string): Promise<Session | null> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;
  return { userId: user.id, storeId: user.storeId, role: user.role, name: user.name };
}

export type Section =
  | "dashboard"
  | "cozinha"
  | "pedidos"
  | "agenda"
  | "producao"
  | "cardapio-do-dia"
  | "receitas"
  | "plano-de-fornadas"
  | "fornadas"
  | "horarios"
  | "excecoes"
  | "entrega"
  | "pagamento"
  | "clientes"
  | "configuracoes";

const ACCESS: Record<Role, Section[] | "all"> = {
  OWNER: "all",
  ATTENDANT: ["dashboard", "cozinha", "pedidos", "agenda", "producao", "cardapio-do-dia", "clientes"],
  KITCHEN: ["cozinha", "pedidos", "agenda", "producao"],
};

export function can(role: Role, section: Section): boolean {
  const a = ACCESS[role];
  return a === "all" || a.includes(section);
}
