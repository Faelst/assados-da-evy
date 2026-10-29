# Assados da Evy — site

SPA em Next.js 16 + Tailwind 4 + Motion.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Onde editar
- **Cardápio, preços, horários, contatos:** `src/lib/data.ts` (os preços só aparecem na seção de orçamento).
- **Logo/fotos:** `public/img/`.

## Leads (nome + WhatsApp)
Capturados antes de liberar os valores do orçamento e no formulário de eventos, enviados a `POST /api/leads`:
- gravados em `data/leads.jsonl` quando o servidor tem disco gravável;
- encaminhados para `LEADS_WEBHOOK_URL` se definido (necessário em hospedagem serverless como a Vercel).

Os pedidos são finalizados no WhatsApp (12) 99105-8305 com a mensagem já preenchida.
