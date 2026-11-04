-- CreateEnum
CREATE TYPE "DeliveryPricing" AS ENUM ('ZONES', 'DISTANCE');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_breakdown" JSONB,
ADD COLUMN     "delivery_distance_km" DOUBLE PRECISION,
ADD COLUMN     "delivery_duration_min" INTEGER;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "delivery_base_cents" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "delivery_max_km" DOUBLE PRECISION NOT NULL DEFAULT 15,
ADD COLUMN     "delivery_min_fee_cents" INTEGER NOT NULL DEFAULT 700,
ADD COLUMN     "delivery_per_km_cents" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "delivery_per_minute_cents" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "delivery_pricing" "DeliveryPricing" NOT NULL DEFAULT 'DISTANCE',
ADD COLUMN     "delivery_service_fee_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "origin_address" TEXT,
ADD COLUMN     "origin_lat" DOUBLE PRECISION,
ADD COLUMN     "origin_lng" DOUBLE PRECISION,
ADD COLUMN     "surge_end" TEXT,
ADD COLUMN     "surge_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "surge_start" TEXT;

-- CreateTable
CREATE TABLE "delivery_quotes" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "address_key" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_quotes_store_id_address_key_idx" ON "delivery_quotes"("store_id", "address_key");

-- AddForeignKey
ALTER TABLE "delivery_quotes" ADD CONSTRAINT "delivery_quotes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
