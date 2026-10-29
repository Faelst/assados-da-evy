import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TYPES = new Set(["contato", "orcamento", "evento"]);

/**
 * Recebe os contatos capturados no site.
 * - Sempre registra no log do servidor.
 * - Se LEADS_WEBHOOK_URL estiver definido (Google Sheets via Apps Script, Make, Zapier, n8n…), encaminha o JSON.
 * - Em ambiente com disco gravável, também anexa em data/leads.jsonl.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const type = String(body.type ?? "");

  if (name.length < 2 || !/^\d{10,11}$/.test(phone) || !TYPES.has(type)) {
    return Response.json({ ok: false, error: "Dados inválidos" }, { status: 422 });
  }

  const lead = { ...body, name, phone, type, receivedAt: new Date().toISOString() };
  console.info("[lead]", JSON.stringify(lead));

  const webhook = process.env.LEADS_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch (err) {
      console.error("[lead] falha no webhook", err);
    }
  }

  try {
    const dir = path.join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "leads.jsonl"), JSON.stringify(lead) + "\n");
  } catch {
    // disco somente leitura (ex.: serverless) — o webhook cobre esse caso
  }

  return Response.json({ ok: true });
}
