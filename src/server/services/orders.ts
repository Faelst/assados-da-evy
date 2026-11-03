import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { canTransition, type OrderStatus, type Role } from "@/server/domain/order-status";
import { dateColumn } from "@/server/domain/time";
import { isValidName, isValidPhone, onlyDigits } from "@/lib/phone";
import { BookingError, consumeHolds } from "./booking";
import { releaseExpiredHolds } from "./batches";
import { getStoreStatus } from "./calendar";
import { quoteDelivery } from "./delivery";
import { StockError, decrementForSale, restoreForCancel } from "./stock";

export type OrderErrorCode =
  | "INVALID"
  | "STORE_CLOSED"
  | "OUT_OF_STOCK"
  | "HOLD_EXPIRED"
  | "NOT_SERVED"
  | "MIN_ORDER"
  | "FULFILLMENT_DISABLED"
  | "PAYMENT_DISABLED"
  | "NOT_FOUND"
  | "INVALID_TRANSITION";

export class OrderError extends Error {
  constructor(public code: OrderErrorCode) {
    super(code);
    this.name = "OrderError";
  }
}

export const ORDER_ERROR_MESSAGE: Record<OrderErrorCode, string> = {
  INVALID: "Confira os dados do pedido.",
  STORE_CLOSED: "A cozinha está fechada agora para pronta entrega.",
  OUT_OF_STOCK: "Algum item acabou de esgotar. Revise o carrinho.",
  HOLD_EXPIRED: "Sua reserva de horário expirou. Escolha o horário de novo.",
  NOT_SERVED: "Ainda não entregamos nesse bairro.",
  MIN_ORDER: "O pedido não atingiu o valor mínimo.",
  FULFILLMENT_DISABLED: "Essa forma de recebimento não está disponível.",
  PAYMENT_DISABLED: "Essa forma de pagamento não está disponível.",
  NOT_FOUND: "Pedido não encontrado.",
  INVALID_TRANSITION: "Essa mudança de status não é permitida.",
};

const addressSchema = z.object({
  cep: z.string().trim().min(8),
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  complement: z.string().trim().optional(),
  district: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(2),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const checkoutSchema = z
  .object({
    type: z.enum(["READY", "SCHEDULED"]),
    sessionId: z.string().min(1),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          variantId: z.string().optional(),
          qty: z.number().int().positive().max(999),
          notes: z.string().max(300).optional(),
        }),
      )
      .min(1),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    handoffAt: z.string().datetime().optional(),
    customer: z.object({
      name: z.string().trim().refine(isValidName),
      phone: z.string().refine(isValidPhone),
      email: z.string().trim().email().optional().or(z.literal("")),
    }),
    fulfillment: z.enum(["PICKUP", "DELIVERY"]),
    address: addressSchema.optional(),
    paymentMethod: z.enum(["PIX", "CASH", "CARD"]),
    changeForCents: z.number().int().nonnegative().optional(),
    notes: z.string().max(500).optional(),
    privacyAccepted: z.literal(true),
  })
  .refine((v) => v.fulfillment === "PICKUP" || !!v.address, { path: ["address"] })
  .refine((v) => v.type === "READY" || (!!v.scheduledDate && !!v.handoffAt), { path: ["handoffAt"] });

export type CheckoutInput = z.input<typeof checkoutSchema>;

function newToken() {
  return randomBytes(18).toString("base64url");
}

export async function createOrder(storeId: string, raw: CheckoutInput, now: Date = new Date()): Promise<{ code: string; publicToken: string }> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) throw new OrderError("INVALID");
  const input = parsed.data;
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });

  if (input.fulfillment === "PICKUP" && !store.pickupEnabled) throw new OrderError("FULFILLMENT_DISABLED");
  if (input.fulfillment === "DELIVERY" && !store.deliveryEnabled) throw new OrderError("FULFILLMENT_DISABLED");
  if (!store.paymentMethods.includes(input.paymentMethod)) throw new OrderError("PAYMENT_DISABLED");

  // preços sempre do banco
  const products = await db.product.findMany({
    where: { storeId, active: true, id: { in: input.items.map((i) => i.productId) } },
    include: { variants: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const mode = input.type === "READY" ? "READY" : "SCHEDULED";
  const lines = input.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p || !p.saleModes.includes(mode)) throw new OrderError("OUT_OF_STOCK");
    const variant = i.variantId ? p.variants.find((v) => v.id === i.variantId) : undefined;
    if (i.variantId && !variant) throw new OrderError("INVALID");
    return {
      productId: p.id,
      variantId: variant?.id,
      name: variant ? `${p.name} (${variant.name})` : p.name,
      unitPriceCents: p.priceCents + (variant?.priceDeltaCents ?? 0),
      qty: i.qty,
      notes: i.notes,
    };
  });
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  if (subtotalCents < store.minOrderCents) throw new OrderError("MIN_ORDER");

  let deliveryFeeCents = 0;
  if (input.fulfillment === "DELIVERY") {
    const quote = await quoteDelivery(storeId, input.address!.district);
    if ("error" in quote) throw new OrderError("NOT_SERVED");
    deliveryFeeCents = quote.feeCents;
  }

  if (input.type === "READY") {
    const status = await getStoreStatus(storeId, now);
    if (!status.open) throw new OrderError("STORE_CLOSED");
  } else {
    await releaseExpiredHolds(now);
  }

  try {
    return await db.$transaction(async (tx) => {
      const phone = onlyDigits(input.customer.phone);
      const customer = await tx.customer.upsert({
        where: { storeId_phone: { storeId, phone } },
        create: { storeId, phone, name: input.customer.name, email: input.customer.email || null },
        update: { name: input.customer.name, ...(input.customer.email ? { email: input.customer.email } : {}) },
      });
      if (input.address) {
        await tx.address.deleteMany({ where: { customerId: customer.id } });
        await tx.address.create({ data: { customerId: customer.id, ...input.address } });
      }

      const seq = await tx.store.update({ where: { id: storeId }, data: { orderSeq: { increment: 1 } }, select: { orderSeq: true } });
      const code = `EVY-${String(seq.orderSeq).padStart(4, "0")}`;
      const publicToken = newToken();

      const order = await tx.order.create({
        data: {
          storeId,
          code,
          customerId: customer.id,
          type: input.type,
          scheduledDate: input.scheduledDate ? dateColumn(input.scheduledDate) : null,
          handoffAt: input.handoffAt ? new Date(input.handoffAt) : null,
          fulfillment: input.fulfillment,
          addressSnapshot: (input.address ?? undefined) as Prisma.InputJsonValue | undefined,
          subtotalCents,
          deliveryFeeCents,
          totalCents: subtotalCents + deliveryFeeCents,
          paymentMethod: input.paymentMethod,
          changeForCents: input.paymentMethod === "CASH" ? input.changeForCents : null,
          notes: input.notes,
          publicToken,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              nameSnapshot: l.name,
              unitPriceCents: l.unitPriceCents,
              qty: l.qty,
              notes: l.notes,
            })),
          },
          history: { create: { toStatus: "AWAITING_CONFIRMATION" } },
        },
        include: { items: true },
      });

      if (input.type === "READY") {
        const status = await getStoreStatus(storeId, now);
        const menu = await tx.dailyMenu.findUnique({
          where: { storeId_date: { storeId, date: dateColumn(status.today) } },
          include: { items: true },
        });
        if (!menu || menu.status !== "OPEN") throw new OrderError("STORE_CLOSED");
        for (const item of order.items) {
          const menuItem = menu.items.find((m) => m.productId === item.productId);
          if (!menuItem) throw new OrderError("OUT_OF_STOCK");
          await decrementForSale(tx, menuItem.id, item.qty, order.id);
        }
      } else {
        await consumeHolds(tx, input.sessionId, order.items.map((i) => ({ id: i.id, productId: i.productId, qty: i.qty })), now);
      }

      return { code, publicToken };
    });
  } catch (e) {
    if (e instanceof StockError) throw new OrderError("OUT_OF_STOCK");
    if (e instanceof BookingError) throw new OrderError("HOLD_EXPIRED");
    throw e;
  }
}

export async function changeStatus(
  orderId: string,
  to: OrderStatus,
  user: { id: string; role: Role },
  reason?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    // trava o pedido para que duas mudanças simultâneas não devolvam estoque em dobro
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    if (rows.length === 0) throw new OrderError("NOT_FOUND");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!canTransition(order.status, to, { type: order.type, fulfillment: order.fulfillment, role: user.role })) {
      throw new OrderError("INVALID_TRANSITION");
    }
    if (to === "CANCELLED") {
      if (order.type === "READY") await restoreForCancel(tx, order.id);
      else await releaseOrderBatches(tx, order.id);
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: to, ...(to === "CANCELLED" ? { cancelReason: reason ?? null } : {}) },
    });
    await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: to, userId: user.id, reason } });
  });
}

async function releaseOrderBatches(tx: Prisma.TransactionClient, orderId: string) {
  const allocations = await tx.orderItemBatch.findMany({ where: { orderItem: { orderId } } });
  for (const a of allocations) {
    await tx.$executeRaw`UPDATE production_batches SET used_units = used_units - ${a.units} WHERE id = ${a.batchId}`;
  }
  await tx.orderItemBatch.deleteMany({ where: { id: { in: allocations.map((a) => a.id) } } });
}

export async function getOrderByToken(token: string) {
  return db.order.findUnique({
    where: { publicToken: token },
    include: {
      items: true,
      customer: true,
      history: { orderBy: { createdAt: "asc" } },
      store: true,
    },
  });
}
