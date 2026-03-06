-- Migration: add tokubai scraping support
-- Add tokubai_shop_url column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tokubai_shop_url VARCHAR(500);

-- Create scraped_leaflets table for tracking processed flyers
CREATE TABLE IF NOT EXISTS scraped_leaflets (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  store_id    UUID        NOT NULL,
  leaflet_id  VARCHAR(50) NOT NULL,
  title       TEXT,
  page_count  INTEGER     NOT NULL DEFAULT 0,
  scraped_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT scraped_leaflets_pkey PRIMARY KEY (id),
  CONSTRAINT scraped_leaflets_store_id_fkey FOREIGN KEY (store_id)
    REFERENCES stores (id) ON DELETE CASCADE,
  CONSTRAINT scraped_leaflets_store_id_leaflet_id_key UNIQUE (store_id, leaflet_id)
);
