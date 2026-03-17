-- Add valid_from / valid_to to scraped_leaflets
ALTER TABLE "scraped_leaflets" ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMP(3);
ALTER TABLE "scraped_leaflets" ADD COLUMN IF NOT EXISTS "valid_to"   TIMESTAMP(3);

-- Add sale_date to pending_reviews (day-specific special tracking)
ALTER TABLE "pending_reviews" ADD COLUMN IF NOT EXISTS "sale_date" TIMESTAMP(3);
