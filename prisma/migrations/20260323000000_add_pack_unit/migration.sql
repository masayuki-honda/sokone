-- Migration: add pack_unit to price_records
ALTER TABLE "price_records" ADD COLUMN "pack_unit" TEXT;
