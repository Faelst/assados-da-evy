# Loja online Assados da Evy — Design

Data: 2026-11-03 · Autor: Rafael Silverio (com Claude)
Documento base: "Micro SaaS de Salgados — Especificação do Produto" (02/11/2026). Este design **segue aquele documento**, exceto onde está dito diferente aqui. As diferenças mais importantes estão em "Modelo de produção por fornadas".

## 1. Intenção

A Evy tem uma cozinha que faz salgados de duas formas: **pronta entrega** (o que já está pronto hoje, com estoque) e **encomenda** (data e horário futuros). Hoje não existe controle: a cozinha pode aceitar mais encomendas do que consegue produzir, e o cliente não sabe o que ainda tem pronto.

O projeto transforma o site atual (landing page com cardápio, eventos e orçamento) na **loja online da Evy**, com um **painel administrativo** para ela configurar a produção e tocar os pedidos. O cliente só consegue comprar o que a cozinha realmente consegue entregar.

Usuários:
- **Clientes da Evy:** entram pelo celular, sem login, compram com nome + WhatsApp.
- **Equipe da Evy:** dono, atendente e cozinha, no painel admin.

## 2. Objetivos

- Vitrine de pronta entrega com estoque em tempo real (esgotou → some o botão de compra).
- Encomenda por data e horário respeitando a capacidade real da cozinha, calculada por **fornada** de cada receita.
- Checkout sem login: nome, WhatsApp, retirada ou entrega, forma de pagamento.
- Painel admin em que a Evy controla **todas** as configurações (horários, receitas, plano de fornadas, estoque, entrega, pagamento, loja).
- **Calendário semanal de produção** no admin: dias × horários, com as fornadas e os pedidos dentro de cada uma.
- Loja e admin **responsivos** (mobile-first na loja; admin utilizável no celular e confortável no desktop).

## 3. Fora do escopo (não-objetivos)

- **Orçamento e eventos:** saem do site agora (seções `Events`, `Quote`, rota `api/leads` e o que só elas usam).
- Gateway de pagamento, notificações por WhatsApp/e-mail (fase 2 do documento base).
- Multi-loja / marketplace / onboarding de outras lojas. Uma loja só; `store_id` em todas as tabelas para não fechar a porta.
- Login de cliente, OTP, "Meus pedidos" (ver decisões abaixo).
- Cancelamento pelo próprio cliente.
- Frete por distância, cupons, fidelidade.
- App nativo. PWA instalável é desejável, mas não bloqueia o MVP.

**Anti-objetivos** (seria fracasso mesmo funcionando):
- Vender a mesma última unidade ou a mesma vaga de fornada para dois clientes.
- Mostrar horário/disponibilidade calculado no fuso do navegador em vez de `America/Sao_Paulo`.
- Exigir cadastro/senha do cliente para comprar.
- Perder a identidade visual da marca.

## 4. Decisões já tomadas com o Rafael

| Tema | Decisão |
|---|---|
| Lojas | Uma só (Assados da Evy). Clientes navegam só nela. |
| Orçamento/eventos | Removidos por enquanto. |
| Stack | Next.js (projeto atual, v16), PostgreSQL. Componentes de cliente + servidor do próprio Next (Server Components, Server Actions / Route Handlers). Sem API separada. |
| Identificação do cliente | Sem login. Só nome + WhatsApp no checkout. |
| Admin | Controla todas as configurações. |
| Capacidade de encomenda | Por **fornada da receita**: cada receita tem quantidade por fornada e tempo de produção (ex.: panetone 10 un / 3 h; hamburgão 15 un / 2 h). |
| Fornadas simultâneas | Configurável no admin. Padrão: **1** (uma fornada ocupa a cozinha). |
| Quem monta o dia | **A Evy monta o plano de fornadas antes.** Para dia com uma receita só, o sistema preenche o dia sozinho com fornadas seguidas e ela ajusta. |
| Visão de agenda | Calendário semanal com horários e os pedidos de cada fornada. |
| Responsivo | Loja e admin. |

Palpites apresentados ao Rafael e não contestados (valem como decididos):
- Carrinho não mistura pronta entrega com encomenda.
- Pronta entrega aceita retirada e entrega, com prazo estimado configurável (ex.: "até 60 min").
- Antecedência mínima padrão 24 h, ajustável por receita.
- Agenda até 30 dias à frente (configurável).
- Cliente não cancela sozinho; cancela falando com a loja.
- Pedido nasce "Aguardando confirmação" e a equipe aceita um a um.
- Taxa de entrega por bairro, com lista de bairros atendidos.

## 5. Modelo de produção por fornadas (substitui "slots" do documento base)

O documento base usa slots genéricos com capacidade em pedidos ou unidades. Aqui a capacidade vem da **receita**.

**Receita (produto) agendável** tem:
- `batch_size` — unidades por fornada (ex.: 10).
- `batch_duration_min` — tempo de produção da fornada (ex.: 180).
- `lead_time_hours` — antecedência mínima (padrão 24).
- `production_units` — quantas unidades da fornada um item desse produto consome (padrão 1). A fornada é contada **por unidade (peça grande)**; a Evy define esse número por produto, por exemplo para pacotes.

**Uma fornada é sempre de um produto só** (decisão do Rafael). Não há grupo de produção que misture sabores.

**Configuração da cozinha:** `parallel_batches` (padrão 1) = quantas fornadas podem estar em produção ao mesmo tempo.

**Plano semanal de fornadas** (substitui `weekday_products` + `slot_templates`): para cada dia da semana, uma lista de fornadas `{receita, início}`. O fim é `início + batch_duration_min`. Regras de validação ao salvar:
- Toda fornada inteira dentro de um turno do horário de funcionamento daquele dia.
- Em nenhum instante o número de fornadas sobrepostas passa de `parallel_batches`.
- Botão **"Preencher dia"**: escolhida uma receita, gera fornadas seguidas do início ao fim de cada turno (ex.: 8h–18h com panetone de 3 h → 8–11, 11–14, 14–17). A Evy pode editar, remover, trocar receita.
- As receitas que aparecem para encomenda num dia são exatamente as que têm fornada no plano desse dia (isso cobre a "regra semanal" do documento base: segunda = panetone, terça = outra).

**Fornadas por data** (`production_batches`, materializadas para os próximos N dias = janela de agenda): `date, product_id, starts_at, ready_at, capacity_units, used_units, held_units, blocked`. Geradas a partir do plano semanal, com exceções aplicadas. A Evy pode, numa data específica, bloquear uma fornada, mudar a capacidade, adicionar ou remover fornadas (com a mesma validação de sobreposição). Alterar o plano semanal regenera apenas fornadas futuras **sem pedidos**; fornadas com pedidos ficam como estão e o admin é avisado do conflito.

**Exceções de calendário** (como no documento base): data fechada, horário especial, ou plano de fornadas especial para a data (ex.: semana do Natal só panetone).

**Como o cliente encomenda:**
1. Escolhe a data no calendário (próximos dias: disponível / poucas vagas / esgotado / fechado).
2. Vê as receitas que têm fornada naquele dia, com as unidades restantes.
3. Adiciona itens e quantidades.
4. Escolhe o **horário de retirada/entrega** entre os horários de "pronto" (`ready_at`) das fornadas do dia.
5. O sistema aloca as unidades de cada item em fornadas **da mesma receita, na mesma data, com `ready_at` ≤ horário escolhido**, preferindo a mais tardia (mais fresca), podendo dividir um item entre fornadas (ex.: 25 panetones = 10 + 10 + 5). Horários em que a alocação não fecha aparecem desabilitados.
6. Fornada com `starts_at` antes de `agora + lead_time_hours` da receita não recebe pedidos.
7. A alocação vira **reserva temporária** (`batch_holds`, 10 min) ao entrar no checkout e é confirmada ao finalizar. Expirou → volta para a escolha de horário.

Toda alocação/confirmação roda em transação com trava de linha (`UPDATE … WHERE capacity_units - used_units - held_units >= :q`), igual ao estoque.

## 6. Pronta entrega

Como no documento base (RN04): cardápio do dia com estoque, baixa atômica na confirmação, cancelamento devolve, ajuste de estoque com motivo (entrada, perda), "Esgotado" sem botão, encerra ao fechar a cozinha sem passar estoque para o dia seguinte. A aba só aparece com a cozinha aberta e cardápio do dia ativo. Prazo estimado de entrega/retirada configurável e exibido.

## 7. Loja (cliente)

Telas do documento base, com estes ajustes:
- **Home:** status (aberta/fechada, horário de hoje), abas **Pronta entrega** e **Encomendar**. Mantém a identidade atual (logo, paleta cream/terracotta/amber, fontes Baloo/Quicksand/Caveat), mas é uma loja, não uma landing page.
- **Encomendar:** calendário → receitas do dia → horário (seção 5).
- **Produto:** foto, descrição, preço, variações (tamanho/sabor) e observação.
- **Carrinho:** um tipo só; trocar de tipo pede confirmação e esvazia.
- **Checkout:** nome, WhatsApp (máscara já existente em `src/lib/leads.ts`, reaproveitar), e-mail opcional; retirada ou entrega; endereço com busca de CEP (ViaCEP), bairro precisa estar na área atendida; forma de pagamento (Pix com chave exibida, dinheiro com "troco para", cartão na entrega); observações; aviso de privacidade (LGPD); resumo com taxa e total. Revalida estoque/fornada no servidor antes de criar o pedido. Pedido mínimo configurável.
- **Confirmação** e **Acompanhar pedido** por link com `public_token`, sem login, com linha do tempo de status e botão para falar com a loja no WhatsApp.
- Lembrar nome/WhatsApp/endereço no navegador (localStorage) para preencher da próxima vez.

## 8. Admin (back-office)

Login por e-mail e senha para a equipe. Papéis como no documento base (Dono, Atendente, Cozinha). Módulos do documento base, mais:

- **Agenda semanal (tela central):** colunas = dias da semana, linhas = horas do dia; cada fornada é um bloco (receita, horário início→pronto, ocupação `x/10`), e ao abrir o bloco aparecem os pedidos alocados nela (cliente, quantidade, retirada/entrega, status). Navega entre semanas. No celular, vira uma lista por dia com o mesmo conteúdo.
- **Plano de fornadas:** edição do plano semanal (seção 5), com "Preencher dia" e validação de sobreposição.
- **Configurações da cozinha:** `parallel_batches`, janela de agenda (dias), duração da reserva no checkout, prazo da pronta entrega.
- **Receitas:** CRUD com foto, preço, categoria, variações, modo de venda (pronta entrega, encomenda, ambos), `batch_size`, `batch_duration_min`, `lead_time_hours`, ativo.
- **Pedidos:** lista com filtros, detalhe, mudança de status, cancelamento com motivo (devolve estoque ou vaga na fornada), impressão de comanda.
- **Produção do dia:** lista consolidada por receita e fornada (o que produzir, quanto, para que horário).
- Dashboard, Cardápio do dia, Horário da cozinha, Exceções, Entrega (bairros e taxas, retirada, endereço de retirada), Pagamento, Clientes, Configurações da loja (nome, logo, WhatsApp, chave Pix, usuários).
- Novos pedidos aparecem sem recarregar (polling curto) com alerta sonoro.

## 9. Status do pedido

8 estados (o diagrama do documento base é imagem; esta é a leitura adotada): **Aguardando confirmação → Confirmado → Em preparo → Pronto → Saiu para entrega → Entregue**, ou **Pronto → Retirado**; **Cancelado** a partir de Aguardando confirmação ou Confirmado. Pronta entrega vai de Confirmado direto para Em preparo; encomenda espera o dia da fornada. Cancelar devolve estoque/vaga. Toda mudança grava em `order_status_history` com usuário e motivo. O papel Cozinha só move Confirmado → Em preparo → Pronto.

## 10. Dados

Modelo do documento base, com estas mudanças:
- `products` + `batch_size`, `batch_duration_min`, `production_units` (remove `slot_units`).
- `stores` + `parallel_batches`, `booking_window_days`, `hold_minutes`, `ready_eta_minutes`, `pix_key`, `pickup_address`.
- `weekday_products` e `slot_templates` → `weekly_batch_plan (store_id, weekday, product_id, start_time)`.
- `exception_products` → `exception_batch_plan (exception_id, product_id, start_time)`.
- `slots` → `production_batches`; `slot_holds` → `batch_holds (batch_id, session_id, units, expires_at)`.
- Nova `order_item_batches (order_item_id, batch_id, units)` para a alocação.
- `orders.slot_id` → `orders.handoff_at` (horário de retirada/entrega escolhido).

Valores em centavos. Datas/horas calculadas sempre em `America/Sao_Paulo`.

## 11. Restrições

- Next.js 16 com mudanças incompatíveis com versões anteriores: **ler `node_modules/next/dist/docs/` antes de escrever código** (regra do `AGENTS.md`).
- Tailwind 4, React 19, TypeScript, `lucide-react` e `motion` já no projeto.
- Concorrência: estoque e fornadas nunca negativos; testes automatizados cobrindo duas compras simultâneas da última unidade/vaga.

## 12. Decisões minhas (Claude), para o Rafael conferir

- **Prisma** como ORM (sugestão do documento base; Rafael não se opôs).
- Eventos sai junto com orçamento.
- "Meus pedidos" fica fora: sem login, o cliente acompanha pelo link do pedido.
- Regra de alocação da seção 5 (horário único de retirada por pedido, alocação na fornada mais tardia ≤ horário, pode dividir entre fornadas).
- Fornadas com pedidos não são apagadas ao mudar o plano semanal.
- Os 8 estados da seção 9.
- Estoque de pronta entrega é independente das fornadas (a Evy digita quanto tem pronto).
- Encomenda com entrega sai no `ready_at`; sem limite de entregadores/capacidade de entrega.
- Variações (ex.: requeijão ou cheddar) não mudam o consumo de fornada; sabores de pacote são escolha registrada no item.

## 13. Deixado para quem for construir

- Biblioteca de autenticação do admin (Auth.js ou sessão própria com cookie httpOnly) e hash de senha.
- Onde guardar fotos (pasta local/volume ou storage S3-compatível).
- Como materializar fornadas (job diário vs. gerar sob demanda ao consultar) e expirar reservas.
- Hospedagem e provedor de Postgres; Docker para desenvolvimento local.
- Estrutura de pastas/rotas (ex.: grupos `(loja)` e `admin`), desde que siga as convenções do Next 16.
- Seed com dados da Evy (produtos atuais de `src/lib/data.ts`, um usuário dono).
