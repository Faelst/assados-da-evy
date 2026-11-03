import { getSession } from "@/server/auth";
import { can } from "@/server/session";
import { kitchenBoard } from "@/server/services/kitchen";

export async function GET() {
  const s = await getSession();
  if (!s || !can(s.role, "cozinha")) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await kitchenBoard(s.storeId), { headers: { "cache-control": "no-store" } });
}
