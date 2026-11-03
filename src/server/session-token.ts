import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/server/domain/order-status";

export type Session = { userId: string; storeId: string; role: Role; name: string };
export const SESSION_COOKIE = "evy_session";
export const SESSION_DAYS = 7;

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET ausente ou curto (mínimo 32 caracteres)");
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { userId, storeId, role, name } = payload as Record<string, unknown>;
    if (typeof userId !== "string" || typeof storeId !== "string" || typeof name !== "string") return null;
    if (role !== "OWNER" && role !== "ATTENDANT" && role !== "KITCHEN") return null;
    return { userId, storeId, role, name };
  } catch {
    return null;
  }
}

