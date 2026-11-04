-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ATTENDANT', 'KITCHEN');

-- CreateEnum
CREATE TYPE "SaleMode" AS ENUM ('READY', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('CLOSED', 'SPECIAL_HOURS', 'SPECIAL_MENU');

-- CreateEnum
CREATE TYPE "DailyMenuStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'SALE', 'CANCEL', 'LOSS');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('READY', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Fulfillment" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "whatsapp" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "min_order_cents" INTEGER NOT NULL DEFAULT 0,
    "parallel_batches" INTEGER NOT NULL DEFAULT 1,
    "booking_window_days" INTEGER NOT NULL DEFAULT 30,
    "hold_minutes" INTEGER NOT NULL DEFAULT 10,
    "ready_eta_minutes" INTEGER NOT NULL DEFAULT 60,
    "pix_key" TEXT,
    "pickup_address" TEXT,
    "pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
    "delivery_enabled" BOOLEAN NOT NULL DEFAULT true,
    "payment_methods" "PaymentMethod"[],
    "order_seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER NOT NULL,
    "image_url" TEXT,
    "sale_modes" "SaleMode"[],
    "lead_time_hours" INTEGER NOT NULL DEFAULT 24,
    "batch_size" INTEGER NOT NULL DEFAULT 10,
    "batch_duration_min" INTEGER NOT NULL DEFAULT 60,
    "production_units" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta_cents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opens_at" TEXT NOT NULL,
    "closes_at" TEXT NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_batch_plan" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,

    CONSTRAINT "weekly_batch_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_exceptions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "opens_at" TEXT,
    "closes_at" TEXT,
    "note" TEXT,

    CONSTRAINT "calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_batch_plan" (
    "id" TEXT NOT NULL,
    "exception_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,

    CONSTRAINT "exception_batch_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batches" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "product_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ready_at" TIMESTAMPTZ(3) NOT NULL,
    "capacity_units" INTEGER NOT NULL,
    "used_units" INTEGER NOT NULL DEFAULT 0,
    "held_units" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "manual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_holds" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "batch_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_menus" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DailyMenuStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "daily_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_menu_items" (
    "id" TEXT NOT NULL,
    "daily_menu_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_initial" INTEGER NOT NULL,
    "qty_available" INTEGER NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "daily_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "daily_menu_item_id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT,
    "order_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "fee_cents" INTEGER NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
    "scheduled_date" DATE,
    "handoff_at" TIMESTAMPTZ(3),
    "fulfillment" "Fulfillment" NOT NULL,
    "address_snapshot" JSONB,
    "subtotal_cents" INTEGER NOT NULL,
    "delivery_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "change_for_cents" INTEGER,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "cancel_reason" TEXT,
    "public_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "name_snapshot" TEXT NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_batches" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "units" INTEGER NOT NULL,

    CONSTRAINT "order_item_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "user_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "products_store_id_idx" ON "products"("store_id");

-- CreateIndex
CREATE INDEX "business_hours_store_id_weekday_idx" ON "business_hours"("store_id", "weekday");

-- CreateIndex
CREATE INDEX "weekly_batch_plan_store_id_weekday_idx" ON "weekly_batch_plan"("store_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_exceptions_store_id_date_key" ON "calendar_exceptions"("store_id", "date");

-- CreateIndex
CREATE INDEX "production_batches_store_id_date_idx" ON "production_batches"("store_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_store_id_product_id_starts_at_key" ON "production_batches"("store_id", "product_id", "starts_at");

-- CreateIndex
CREATE INDEX "batch_holds_session_id_idx" ON "batch_holds"("session_id");

-- CreateIndex
CREATE INDEX "batch_holds_expires_at_idx" ON "batch_holds"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_menus_store_id_date_key" ON "daily_menus"("store_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_menu_items_daily_menu_id_product_id_key" ON "daily_menu_items"("daily_menu_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_store_id_phone_key" ON "customers"("store_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_store_id_district_key" ON "delivery_zones"("store_id", "district");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_token_key" ON "orders"("public_token");

-- CreateIndex
CREATE INDEX "orders_store_id_created_at_idx" ON "orders"("store_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_store_id_code_key" ON "orders"("store_id", "code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_batch_plan" ADD CONSTRAINT "weekly_batch_plan_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_batch_plan" ADD CONSTRAINT "weekly_batch_plan_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_batch_plan" ADD CONSTRAINT "exception_batch_plan_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "calendar_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_batch_plan" ADD CONSTRAINT "exception_batch_plan_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_holds" ADD CONSTRAINT "batch_holds_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menus" ADD CONSTRAINT "daily_menus_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_daily_menu_id_fkey" FOREIGN KEY ("daily_menu_id") REFERENCES "daily_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_daily_menu_item_id_fkey" FOREIGN KEY ("daily_menu_item_id") REFERENCES "daily_menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batches" ADD CONSTRAINT "order_item_batches_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batches" ADD CONSTRAINT "order_item_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "production_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Consistência: estoque e capacidade nunca negativos nem acima do limite
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_units_check"
  CHECK ("used_units" >= 0 AND "held_units" >= 0 AND "used_units" + "held_units" <= "capacity_units");
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_qty_check"
  CHECK ("qty_available" >= 0);
ALTER TABLE "batch_holds" ADD CONSTRAINT "batch_holds_units_check" CHECK ("units" > 0);
