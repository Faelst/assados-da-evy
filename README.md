# Assados da Evy — loja online

Loja da Evy com **pronta entrega** (estoque do dia) e **encomenda por fornadas** (data e horário com capacidade real da cozinha), mais um **painel admin** para configurar a produção e tocar os pedidos.

- Design: `docs/superpowers/specs/2026-11-03-loja-assados-da-evy-design.md`
- Plano de implementação: `docs/superpowers/plans/2026-11-03-loja-assados-da-evy.md`

## Stack

Next.js 16 (App Router, Cache Components, Server Actions) · React 19 · Tailwind 4 · PostgreSQL · Prisma 7 · Vitest

## Rodando localmente

Requisitos: Node 24+, PostgreSQL 16 rodando.

```bash
cp .env.example .env          # ajuste DATABASE_URL e gere AUTH_SECRET (openssl rand -hex 32)
createdb assados_da_evy
createdb assados_da_evy_test  # usado pelos testes
npm install                   # também gera o Prisma Client
npm run db:migrate            # cria as tabelas
npm run db:seed               # loja, cardápio da Evy, horários, plano de fornadas, bairros e um usuário dono
npm run dev
```

- Loja: http://localhost:3000
- Painel: http://localhost:3000/admin — usuário criado pelo seed: `evy@assadosdaevy.com.br`, senha `trocar123`. **Troque a senha em Configurações** no primeiro acesso.

## Testes

```bash
npm test          # regras de fornada, alocação, reservas, estoque, pedidos (usa DATABASE_URL_TEST)
npx tsc --noEmit
npm run lint
npm run build
```

## Como funciona a capacidade

- Cada **receita** tem unidades por fornada, tempo de forno e antecedência mínima.
- O **plano de fornadas** diz, para cada dia da semana, que receita entra no forno e a que horas (botão "Preencher dia" monta fornadas seguidas). A configuração **fornadas ao mesmo tempo** (padrão 1) impede sobreposição.
- O cliente escolhe a data, as quantidades e o **horário em que fica pronto**; o sistema reserva as vagas por alguns minutos no checkout e confirma ao finalizar, em transação, sem vender a mesma vaga duas vezes.
- **Pronta entrega** usa o estoque digitado no "Cardápio do dia", com baixa atômica.

Fotos enviadas no painel ficam em `uploads/` (fora do git) e são servidas por `/api/uploads/...`.
