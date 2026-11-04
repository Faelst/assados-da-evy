import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { BRAND, CATEGORIES, MENU } from "../src/lib/data";
import { fillDay } from "../src/server/domain/production";
import { dateColumn, todayIn } from "../src/server/domain/time";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const OWNER_EMAIL = "evy@assadosdaevy.com.br";
const OWNER_PASSWORD = "trocar123";

const IMAGES: Record<string, string> = {
  pizza: "/img/pizza-enrolada.png",
  assadinhos: "/img/assadinhos.png",
};

/** Produção padrão por categoria: unidades por fornada e minutos de forno. */
const PRODUCTION: Record<string, { batchSize: number; batchDurationMin: number; ready: boolean }> = {
  individual: { batchSize: 15, batchDurationMin: 120, ready: true },
  pizza: { batchSize: 10, batchDurationMin: 120, ready: true },
  assadinhos: { batchSize: 5, batchDurationMin: 60, ready: false },
  doce: { batchSize: 20, batchDurationMin: 60, ready: true },
};

/** Uma receita por dia, como a Evy trabalha (o admin ajusta depois). */
const WEEK_PLAN: Record<number, string> = {
  2: "hamburgao-sadia",
  3: "brocao",
  4: "frangao",
  5: "pz-calafrango",
  6: "assadinhos-100",
};

const HOURS = [
  ...[2, 3, 4, 5].map((weekday) => ({ weekday, opensAt: "09:00", closesAt: "18:00" })),
  { weekday: 6, opensAt: "09:00", closesAt: "14:00" },
];

async function main() {
  let store = await db.store.findUnique({ where: { slug: "assados-da-evy" } });
  if (!store) {
    store = await db.store.create({
      data: {
        name: BRAND.name,
        slug: "assados-da-evy",
        logoUrl: "/img/logo.webp",
        whatsapp: BRAND.whatsapp,
        pixKey: BRAND.whatsappDisplay,
        pickupAddress: `${BRAND.city} — combine o endereço pelo WhatsApp`,
        paymentMethods: ["PIX", "CASH", "CARD"],
        minOrderCents: 0,
        // ponto de saída provisório (Centro de Jacareí): ajuste em Painel > Entrega
        deliveryPricing: "DISTANCE",
        originAddress: "Praça dos Três Poderes, Jacareí - SP",
        originLat: -23.306,
        originLng: -45.975,
      },
    });
    console.log("Loja criada");
  }
  const storeId = store.id;

  if (!(await db.user.findUnique({ where: { email: OWNER_EMAIL } }))) {
    await db.user.create({
      data: { storeId, name: "Evy", email: OWNER_EMAIL, passwordHash: await bcrypt.hash(OWNER_PASSWORD, 10), role: "OWNER" },
    });
    console.log(`Usuário dono: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  }

  if ((await db.product.count({ where: { storeId } })) === 0) {
    const categoryIds: Record<string, string> = {};
    for (const [i, c] of CATEGORIES.entries()) {
      const cat = await db.category.create({ data: { storeId, name: c.title, sortOrder: i } });
      categoryIds[c.id] = cat.id;
    }
    const slugToId: Record<string, string> = {};
    for (const [i, m] of MENU.entries()) {
      const prod = PRODUCTION[m.category];
      const p = await db.product.create({
        data: {
          storeId,
          categoryId: categoryIds[m.category],
          name: m.name,
          description: m.description,
          priceCents: Math.round(m.price * 100),
          imageUrl: IMAGES[m.category] ?? null,
          saleModes: prod.ready ? ["READY", "SCHEDULED"] : ["SCHEDULED"],
          leadTimeHours: 24,
          batchSize: prod.batchSize,
          batchDurationMin: prod.batchDurationMin,
          productionUnits: 1,
          sortOrder: i,
        },
      });
      slugToId[m.id] = p.id;
    }

    await db.businessHour.createMany({ data: HOURS.map((h) => ({ storeId, ...h })) });

    for (const [weekdayStr, slug] of Object.entries(WEEK_PLAN)) {
      const weekday = Number(weekdayStr);
      const productId = slugToId[slug];
      const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
      const shifts = HOURS.filter((h) => h.weekday === weekday);
      const batches = fillDay(productId, product.batchDurationMin, shifts);
      await db.weeklyBatchPlan.createMany({ data: batches.map((b) => ({ storeId, weekday, productId, startTime: b.startTime })) });
    }

    await db.deliveryZone.createMany({
      data: [
        { storeId, district: "Centro", feeCents: 600 },
        { storeId, district: "Jardim Califórnia", feeCents: 800 },
        { storeId, district: "Parque Brasil", feeCents: 800 },
        { storeId, district: "Cidade Salvador", feeCents: 1000 },
      ],
    });
    console.log(`${MENU.length} produtos, horários, plano de fornadas e bairros criados`);
  }

  // cardápio de pronta entrega de hoje (só se ainda não existe)
  const today = todayIn(store.timezone);
  const exists = await db.dailyMenu.findUnique({ where: { storeId_date: { storeId, date: dateColumn(today) } } });
  if (!exists) {
    const readyProducts = await db.product.findMany({
      where: { storeId, saleModes: { has: "READY" }, category: { name: "Individual" } },
    });
    await db.dailyMenu.create({
      data: {
        storeId,
        date: dateColumn(today),
        items: {
          create: readyProducts.map((p) => ({
            productId: p.id,
            qtyInitial: 8,
            qtyAvailable: 8,
            movements: { create: { type: "IN", qty: 8, reason: "seed" } },
          })),
        },
      },
    });
    console.log(`Cardápio do dia ${today} criado`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
