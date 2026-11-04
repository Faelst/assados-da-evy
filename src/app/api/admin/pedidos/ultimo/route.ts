import { db } from "@/server/db";
import { getSession } from "@/server/auth";

export async function GET() {
  const s = await getSession();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const last = await db.order.findFirst({ where: { storeId: s.storeId }, orderBy: { createdAt: "desc" }, select: { id: true, code: true } });
  return Response.json({ id: last?.id ?? null, code: last?.code ?? null });
}
