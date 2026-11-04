import { z } from "zod";
import { getStore } from "@/server/store";
import { availableHandoffs } from "@/server/services/booking";

const body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive().max(999) })).min(1).max(50),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json([], { status: 400 });
  const store = await getStore();
  const slots = await availableHandoffs(store.id, parsed.data.date, parsed.data.items);
  return Response.json(slots.map((s) => ({ at: s.at.toISOString(), label: s.label, available: s.available })));
}
