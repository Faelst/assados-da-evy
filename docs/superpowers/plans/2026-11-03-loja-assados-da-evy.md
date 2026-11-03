# Loja Assados da Evy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a landing page atual na loja online da Evy (pronta entrega + encomenda por fornadas) com painel admin, rodando localmente com PostgreSQL.

**Architecture:** Next.js 16 App Router fullstack. Regras de negócio puras em `src/server/domain/*` (testáveis sem banco), acesso a dados e transações em `src/server/services/*` (Prisma, testados contra um Postgres de teste), UI em `src/app/(loja)` e `src/app/admin` usando Server Components para leitura e Server Actions para escrita; carrinho no cliente (localStorage).

**Tech Stack:** Next 16.4.3, React 19.3, Tailwind 4, TypeScript, Prisma 7.10.1 + `@prisma/adapter-pg` + `pg`, Zod 4, bcryptjs 3, jose 6 (sessão admin), Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-03-loja-assados-da-evy-design.md` (e o documento base que ele referencia).

## Global Constraints

- Ler `node_modules/next/dist/docs/` antes de usar uma API do Next. `cacheComponents: true` está ligado: leituras de banco/cookies/`new Date()` em Server Components ficam dentro de `<Suspense>` ou depois de `await connection()`; `params`/`searchParams`/`cookies()` são assíncronos; proteção de rota em `src/proxy.ts` exportando `proxy` (não `middleware`).
- Fuso: todo cálculo de data/hora em `America/Sao_Paulo` (`stores.timezone`), nunca no fuso do navegador/servidor.
- Dinheiro em centavos (`Int`).
- Toda tabela de domínio tem `store_id`.
- Estoque e fornadas nunca negativos: baixa com `UPDATE … WHERE disponível >= :q` dentro de transação.
- Cliente compra sem login: só nome + WhatsApp (reusar `maskPhone`/`isValidPhone` de `src/lib/leads.ts`, movidos para `src/lib/phone.ts`).
- Identidade visual atual: tokens de `src/app/globals.css` (cream, terracotta, amber, ink, tomato; fontes Baloo/Quicksand/Caveat), logo `public/img/logo.webp`.
- Responsivo: loja mobile-first; admin funciona a partir de 360 px.
- Textos da UI em português do Brasil.

## Review Focus

1. Pedido feito perto da meia-noite / servidor em UTC: a "data de hoje" e as fornadas do dia devem ser as de São Paulo → teste em Task 2 com `now = 2026-11-04T02:30Z` (23:30 de 03/11 em SP) devolvendo `2026-11-03`.
2. Dois clientes comprando a última unidade/vaga ao mesmo tempo → só um pedido nasce; teste concorrente em Task 5 e Task 6.
3. Reserva expirada no checkout → confirmar pedido falha com erro `HOLD_EXPIRED` e as vagas voltam; teste em Task 5.
4. Mudança do plano semanal com fornada já vendida → fornada vendida permanece; teste em Task 4.
5. Cancelamento devolve estoque/vaga exatamente uma vez (cancelar duas vezes não devolve em dobro); teste em Task 7.

---

### Task 1: Banco, Prisma e infraestrutura de testes

**Files:**
- Modify: `package.json` (deps + scripts `db:migrate`, `db:seed`, `test`), `next.config.ts` (`serverExternalPackages: ["pg"]` se necessário), `.gitignore` (`.env*.local`, `src/generated`)
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `.env.example`, `.env` (local, não commitado), `src/server/db.ts`, `vitest.config.ts`, `tests/setup-db.ts`, `tests/db.test.ts`

**Interfaces:**
- Produces: `db` (PrismaClient singleton) em `src/server/db.ts`; tipos gerados em `src/generated/prisma`; helper de teste `resetDb(): Promise<void>` e `seedStore(overrides?): Promise<Store>` em `tests/setup-db.ts`.

Schema (nomes Prisma camelCase, `@@map` snake_case): `Store`(id, name, slug, logoUrl, whatsapp, timezone="America/Sao_Paulo", minOrderCents=0, parallelBatches=1, bookingWindowDays=30, holdMinutes=10, readyEtaMinutes=60, pixKey, pickupAddress, deliveryEnabled, pickupEnabled, paymentMethods String[]), `User`(role enum OWNER|ATTENDANT|KITCHEN, email unique, passwordHash), `Category`, `Product`(priceCents, saleModes enum[] READY|SCHEDULED, leadTimeHours=24, batchSize, batchDurationMin, productionUnits=1, imageUrl, active, sortOrder), `ProductVariant`, `BusinessHour`(weekday 0–6, opensAt/closesAt "HH:mm"), `WeeklyBatchPlan`(weekday, productId, startTime "HH:mm"), `CalendarException`(date @db.Date, type CLOSED|SPECIAL_HOURS|SPECIAL_MENU, opensAt?, closesAt?), `ExceptionBatchPlan`(exceptionId, productId, startTime), `ProductionBatch`(date @db.Date, productId, startsAt, readyAt timestamptz, capacityUnits, usedUnits=0, heldUnits=0, blocked=false, manual=false), `BatchHold`(batchId, sessionId, units, expiresAt), `DailyMenu`(date, status OPEN|CLOSED, unique store+date), `DailyMenuItem`(qtyInitial, qtyAvailable, paused), `StockMovement`(type IN|OUT|SALE|CANCEL|LOSS, qty, reason, userId?), `Customer`(phone unique per store), `Address`, `DeliveryZone`(district, feeCents), `Order`(code, type READY|SCHEDULED, status enum, scheduledDate?, handoffAt?, fulfillment PICKUP|DELIVERY, addressSnapshot Json?, subtotalCents, deliveryFeeCents, totalCents, paymentMethod PIX|CASH|CARD, changeForCents?, paymentStatus PENDING|PAID, notes, publicToken unique, cancelReason), `OrderItem`(nameSnapshot, unitPriceCents, qty, notes, variantId?), `OrderItemBatch`(orderItemId, batchId, units), `OrderStatusHistory`. `OrderStatus` = `AWAITING_CONFIRMATION | CONFIRMED | PREPARING | READY | OUT_FOR_DELIVERY | DELIVERED | PICKED_UP | CANCELLED`.

- [ ] **Step 1:** `npm i @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg zod bcryptjs jose` e `npm i -D prisma@7.10.1 vitest @types/pg tsx`. Criar bancos `assados_da_evy` e `assados_da_evy_test` (`createdb`).
- [ ] **Step 2:** Escrever `tests/db.test.ts`: `resetDb()` + `seedStore()` cria loja e `db.store.count()` retorna 1.
- [ ] **Step 3:** Rodar `npx vitest run tests/db.test.ts` → FAIL (schema inexistente).
- [ ] **Step 4:** Escrever schema, `prisma.config.ts` (datasource url de `DATABASE_URL`), `src/server/db.ts` com `PrismaPg`, `npx prisma migrate dev --name init`; vitest usa `DATABASE_URL_TEST` e roda `prisma migrate deploy` no globalSetup; testes em série (`fileParallelism: false`).
- [ ] **Step 5:** `npx vitest run` → PASS. `npx tsc --noEmit` limpo.
- [ ] **Step 6:** Commit `feat: banco e prisma para a loja`.

### Task 2: Tempo no fuso da loja

**Files:** Create `src/server/domain/time.ts`, `tests/domain/time.test.ts`

**Interfaces:**
- Produces: `type LocalDate = string` ("YYYY-MM-DD"); `todayIn(tz: string, now?: Date): LocalDate`; `weekdayOf(date: LocalDate): number` (0=domingo); `zonedToUtc(date: LocalDate, hhmm: string, tz: string): Date`; `utcToLocalHHmm(d: Date, tz: string): string`; `addDays(date: LocalDate, n: number): LocalDate`; `minutesOf(hhmm: string): number`; `hhmmOf(minutes: number): string`.

- [ ] **Step 1:** Testes: `todayIn("America/Sao_Paulo", new Date("2026-11-04T02:30:00Z")) === "2026-11-03"`; `zonedToUtc("2026-11-03","08:00","America/Sao_Paulo").toISOString() === "2026-11-03T11:00:00.000Z"`; `weekdayOf("2026-11-02") === 1`; `addDays("2026-12-31",1) === "2027-01-01"`.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar com `Intl.DateTimeFormat` (sem libs). **Step 4:** PASS. **Step 5:** Commit.

### Task 3: Regras puras de produção

**Files:** Create `src/server/domain/production.ts`, `tests/domain/production.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `type Shift = { opensAt: string; closesAt: string }`
  - `type PlannedBatch = { productId: string; startTime: string; durationMin: number }`
  - `validatePlan(batches: PlannedBatch[], shifts: Shift[], parallel: number): { ok: true } | { ok: false; errors: PlanError[] }` com `PlanError = { index: number; code: "OUTSIDE_HOURS" | "OVERLAP" }`
  - `fillDay(productId: string, durationMin: number, shifts: Shift[]): PlannedBatch[]`
  - `resolveDay(input: { weekday: number; date: LocalDate; hours: BusinessHourRow[]; plan: PlanRow[]; exception?: ExceptionRow & { plan: PlanRow[] } }): { closed: boolean; shifts: Shift[]; plan: { productId: string; startTime: string }[] }` (exceção CLOSED fecha; SPECIAL_HOURS troca turnos e descarta fornadas fora deles; SPECIAL_MENU troca o plano)
  - `isOpenAt(shifts: Shift[], hhmm: string): boolean`

- [ ] **Step 1:** Testes: `fillDay("p",180,[{opensAt:"08:00",closesAt:"18:00"}])` → inícios `["08:00","11:00","14:00"]`; com dois turnos 08–12 e 14–18 e duração 120 → `["08:00","10:00","14:00","16:00"]`; `validatePlan` com panetone 08:00/180 + hamburgão 10:00/120 e `parallel=1` → erro `OVERLAP` no índice 1; mesmo caso com `parallel=2` → ok; fornada 17:00/180 com fechamento 18:00 → `OUTSIDE_HOURS`; `resolveDay` com exceção CLOSED → `closed: true`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (varredura de eventos início/fim para contar sobreposição). **Step 4:** PASS. **Step 5:** Commit.

### Task 4: Materialização de fornadas

**Files:** Create `src/server/services/batches.ts`, `tests/services/batches.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `ensureBatches(storeId: string, from: LocalDate, to: LocalDate): Promise<void>` (idempotente; cria fornadas faltantes; remove fornadas não-manuais sem `usedUnits`/`heldUnits` que não estão mais no plano; nunca toca fornada com vendas ou `manual`); `regenerateFuture(storeId: string): Promise<{ conflicts: ProductionBatch[] }>` (chamado ao salvar plano/exceção; conflitos = fornadas com vendas que saíram do plano); `listDayBatches(storeId, date): Promise<BatchView[]>` com `BatchView = { id, productId, productName, startsAt, readyAt, capacityUnits, freeUnits, blocked }` onde `freeUnits = capacity - used - heldNãoExpirado`.

- [ ] **Step 1:** Testes: plano segunda panetone 08:00 (10 un/180 min) → `ensureBatches` na segunda 2026-11-09 cria 1 fornada com `readyAt` = 11:00 SP; rodar duas vezes não duplica; remover do plano + `regenerateFuture` apaga a vazia; com `usedUnits=3` ela permanece e volta em `conflicts`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit.

### Task 5: Alocação de encomendas e reservas

**Files:** Create `src/server/domain/allocation.ts`, `src/server/services/booking.ts`, `tests/domain/allocation.test.ts`, `tests/services/booking.test.ts`

**Interfaces:**
- Produces:
  - `allocate(items: { productId: string; units: number }[], batches: BatchView[], handoffAt: Date, now: Date, leadHoursByProduct: Record<string, number>): Allocation | null`, `Allocation = { batchId: string; productId: string; units: number }[]` — usa só fornadas do produto com `readyAt <= handoffAt`, não bloqueadas, `startsAt >= now + leadTime`; preenche da mais tardia para a mais cedo; `null` se não fecha.
  - `availableHandoffs(storeId, date, items, now?): Promise<{ at: Date; label: string; available: boolean }[]>` (um por `readyAt` distinto do dia).
  - `availableDates(storeId, now?): Promise<{ date: LocalDate; status: "AVAILABLE" | "FEW" | "SOLD_OUT" | "CLOSED" }[]>` (janela `bookingWindowDays`; FEW = < 20% livre).
  - `holdBooking(storeId, sessionId, date, items, handoffAt): Promise<{ holdIds: string[]; expiresAt: Date } | { error: "UNAVAILABLE" }>` — libera holds anteriores da mesma sessão; incrementa `heldUnits` com `UPDATE … WHERE capacity_units - used_units - held_units >= :u`.
  - `releaseExpiredHolds(): Promise<number>` (chamado no início de `holdBooking`, `availableHandoffs` e da confirmação).
  - `consumeHolds(tx, sessionId, orderItems): Promise<void>` → converte held em used e grava `OrderItemBatch`; lança `BookingError("HOLD_EXPIRED")` se faltar hold válido.
  - `units = qty * product.productionUnits`.

- [ ] **Step 1:** Testes de `allocate`: 25 panetones com fornadas de 10 prontas às 11/14/17 e handoff 17:00 → `[17:10, 14:10, 11:5]`; handoff 11:00 com 15 → `null`; lead time 24 h exclui fornada de amanhã cedo.
- [ ] **Step 2:** Testes de serviço: duas `holdBooking` concorrentes (`Promise.all`) pela última vaga → exatamente uma ok; hold expirado (mover `expiresAt` para o passado) → `consumeHolds` lança `HOLD_EXPIRED` e `heldUnits` volta a 0.
- [ ] **Step 3–5:** FAIL → implementar → PASS → Commit.

### Task 6: Pronta entrega e estoque

**Files:** Create `src/server/services/stock.ts`, `tests/services/stock.test.ts`

**Interfaces:**
- Produces: `getTodayMenu(storeId, now?): Promise<{ open: boolean; items: { itemId, productId, name, priceCents, imageUrl, qtyAvailable, paused }[] } | null>`; `upsertDailyMenu(storeId, date, items: { productId; qty }[], userId)`; `adjustStock(itemId, delta: number, type: "IN" | "OUT" | "LOSS", reason: string, userId)`; `decrementForSale(tx, itemId, qty, orderId): Promise<void>` (lança `StockError("OUT_OF_STOCK")`); `restoreForCancel(tx, orderId)`; `closeDailyMenu(storeId, date)`.

- [ ] **Step 1:** Testes: estoque 1 e duas vendas concorrentes → uma falha com `OUT_OF_STOCK`, `qtyAvailable` = 0; `adjustStock` negativo além do disponível falha; toda operação cria `StockMovement`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit.

### Task 7: Pedidos e status

**Files:** Create `src/server/domain/order-status.ts`, `src/server/services/orders.ts`, `src/server/services/delivery.ts`, `tests/domain/order-status.test.ts`, `tests/services/orders.test.ts`

**Interfaces:**
- Produces:
  - `canTransition(from: OrderStatus, to: OrderStatus, ctx: { type: "READY" | "SCHEDULED"; fulfillment: "PICKUP" | "DELIVERY"; role: Role }): boolean` — fluxo da spec seção 9; KITCHEN só `CONFIRMED→PREPARING`, `PREPARING→READY`; `OUT_FOR_DELIVERY` só se DELIVERY; `PICKED_UP` só se PICKUP; CANCELLED só de AWAITING_CONFIRMATION/CONFIRMED.
  - `checkoutSchema` (Zod): `{ type, sessionId, items: { productId, variantId?, qty, notes? }[], scheduledDate?, handoffAt?, customer: { name, phone, email? }, fulfillment, address?: { cep, street, number, complement?, district, city, state, reference?, notes? }, paymentMethod, changeForCents?, notes?, privacyAccepted: true }`.
  - `quoteDelivery(storeId, district): Promise<{ feeCents: number } | { error: "NOT_SERVED" }>`.
  - `createOrder(storeId, input): Promise<{ code: string; publicToken: string }>` — numa transação: upsert Customer por telefone, recalcula preços do banco (ignora preço do cliente), valida pedido mínimo e área, baixa estoque (READY) ou consome holds (SCHEDULED), grava `OrderStatusHistory` inicial; `code` sequencial legível (ex.: `EVY-0042`).
  - `changeStatus(orderId, to, userId, role, reason?)`; cancelamento chama `restoreForCancel` ou devolve `usedUnits` das `OrderItemBatch` — idempotente.
  - `getOrderByToken(token)`.

- [ ] **Step 1:** Testes: tabela de `canTransition` (inclui KITCHEN tentando CANCELLED → false); `createOrder` READY baixa estoque e cria histórico; preço adulterado no input é ignorado; bairro fora da área → erro; cancelar duas vezes devolve estoque uma vez só; pedido SCHEDULED cancelado devolve `usedUnits`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit.

### Task 8: Seed com dados da Evy

**Files:** Create `prisma/seed.ts`; Modify `package.json` (`db:seed`)

Loja "Assados da Evy" (slug `assados-da-evy`, WhatsApp de `src/lib/data.ts`), usuário dono `evy@assadosdaevy.com.br` / senha `trocar123` (avisar no README), categorias e os 16 produtos de `src/lib/data.ts` (individuais e pizzas: READY+SCHEDULED, batchSize 15, 120 min; assadinhos: SCHEDULED, `productionUnits` = 1, batchSize 100, 60 min; preços em centavos), horário seg–sáb 08:00–18:00, plano: seg = panetone? (não existe no cardápio → usar Hamburgão Sadia via `fillDay`), ter–sáb uma receita por dia via `fillDay`, zonas de entrega de exemplo com taxa fixa, cardápio do dia de hoje com estoque. Idempotente.

- [ ] **Step 1:** `npm run db:seed` duas vezes sem erro; `psql assados_da_evy -c "select count(*) from products"` → 16. **Step 2:** Commit.

### Task 9: Autenticação do admin

**Files:** Create `src/server/auth.ts`, `src/proxy.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`, `tests/services/auth.test.ts`

**Interfaces:**
- Produces: `login(email, password): Promise<boolean>` (cookie httpOnly `evy_session`, JWT HS256 com `AUTH_SECRET`, 7 dias); `logout()`; `getSession(): Promise<{ userId; storeId; role; name } | null>`; `requireRole(...roles: Role[]): Promise<Session>` (redireciona para `/admin/login` ou `forbidden`); `proxy` redireciona `/admin/*` (exceto login) sem cookie para `/admin/login`. Permissões: OWNER tudo; ATTENDANT pedidos, cardápio do dia, estoque, agenda; KITCHEN agenda/produção e status de preparo.
- [ ] **Step 1:** Teste `verifyPassword` + `signSession`/`readSession` ida e volta; token adulterado → `null`. **Step 2–4:** FAIL → implementar → PASS. **Step 5:** Commit.

### Task 10: Loja do cliente

**Files:**
- Delete: `src/components/{Events,Quote,Contact,Manifesto,Highlights,Menu,Hero,Field}.tsx` quando não usados, `src/app/api/leads/route.ts`, `src/lib/leads.ts` (após mover telefone para `src/lib/phone.ts`); reduzir `src/lib/data.ts` ao que o seed usa (ou mover para `prisma/`).
- Create: `src/app/(loja)/layout.tsx`, `page.tsx` (home com status + abas), `pronta-entrega/page.tsx`, `encomendar/page.tsx` (calendário), `encomendar/[data]/page.tsx` (receitas do dia + horários), `produto/[id]/page.tsx`, `carrinho/page.tsx`, `checkout/page.tsx`, `checkout/actions.ts`, `pedido/[token]/page.tsx`; `src/components/loja/*` (StoreStatus, ProductCard, Calendar, HandoffPicker, CartProvider, CartButton, CheckoutForm, CepField, OrderTimeline); `src/app/api/handoffs/route.ts` (GET disponibilidade para o cliente).
- Modify: `src/app/layout.tsx` (metadata), `src/components/Nav.tsx`.

**Interfaces:**
- Consumes: Tasks 4–7.
- `CartProvider` (client, localStorage `evy:cart`): `{ type: "READY" | "SCHEDULED" | null; date?: LocalDate; items: CartItem[] }`; adicionar item de outro tipo/data pede confirmação e esvazia. `sessionId` = `crypto.randomUUID()` em localStorage `evy:session`. Dados do cliente lembrados em `evy:customer`.
- Checkout SCHEDULED: ao abrir chama a Server Action `holdAction` e mostra contagem regressiva; expirou → volta para escolher horário. `placeOrderAction` → redireciona para `/pedido/[token]`.
- CEP via `https://viacep.com.br/ws/{cep}/json/` no cliente.
- [ ] **Step 1:** Implementar páginas. **Step 2:** `npm run build` sem erro. **Step 3:** Verificar no navegador (Task 13) os fluxos pronta entrega e encomenda até a página do pedido. **Step 4:** Commit.

### Task 11: Admin — pedidos, dashboard, agenda

**Files:** Create `src/app/admin/(painel)/layout.tsx` (menu lateral; gaveta no mobile; filtra itens por papel), `page.tsx` (dashboard: pedidos de hoje por status, próximas fornadas e ocupação, estoque acabando, faturamento dia/semana), `pedidos/page.tsx` (filtros tipo/status/data via searchParams), `pedidos/[id]/page.tsx` (detalhe, botões de status válidos via `canTransition`, cancelar com motivo, imprimir comanda com `@media print`), `pedidos/actions.ts`, `agenda/page.tsx` (semana: colunas dias, linhas 06–22h, blocos de fornada `x/cap`, clique abre pedidos; `?semana=YYYY-MM-DD`; no mobile lista por dia), `producao/page.tsx` (consolidado por receita e fornada do dia), `src/components/admin/NewOrdersWatcher.tsx` (polling 15 s em `/api/admin/orders/latest`, toca `public/sounds/novo-pedido.mp3` ou beep WebAudio), `src/app/api/admin/orders/latest/route.ts`.
- [ ] **Step 1:** Implementar. **Step 2:** `npm run build`. **Step 3:** Verificar no navegador: pedido feito na loja aparece no painel sem recarregar; mudar status reflete na página do cliente. **Step 4:** Commit.

### Task 12: Admin — configurações

**Files:** Create em `src/app/admin/(painel)/`: `receitas/` (lista + form criar/editar, upload de foto para `public/uploads/` via Server Action), `cardapio-do-dia/` (montar cardápio, ajustar estoque com motivo, pausar), `plano-de-fornadas/` (por dia da semana: lista de fornadas, "Preencher dia", erros de `validatePlan`, ao salvar chama `regenerateFuture` e mostra conflitos), `fornadas/` (por data: bloquear, mudar capacidade, adicionar/remover manual), `horarios/` (turnos por dia), `excecoes/`, `entrega/` (modos, bairros e taxas, endereço de retirada, pedido mínimo, prazo pronta entrega), `pagamento/` (formas aceitas, chave Pix), `clientes/` (lista + histórico), `configuracoes/` (loja: nome, WhatsApp, fornadas simultâneas, janela de agenda, minutos de reserva; usuários e papéis — só OWNER). Cada pasta com `actions.ts` validando com Zod e `requireRole`.
- [ ] **Step 1:** Implementar. **Step 2:** `npm run build`. **Step 3:** Verificar no navegador: mudar plano de terça reflete no calendário da loja; ajustar estoque reflete na pronta entrega. **Step 4:** Commit.

### Task 13: Subir local e verificar ponta a ponta

- [ ] **Step 1:** `npm test` (tudo PASS), `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 2:** `npm run dev`; no navegador (desktop e 390 px): pedido pronta entrega com entrega; encomenda com retirada; login admin; pedido aparece com alerta; mudar status; agenda semanal mostra o pedido na fornada.
- [ ] **Step 3:** Atualizar `README.md` (requisitos, `.env`, `db:migrate`, `db:seed`, login do admin) e commit.
