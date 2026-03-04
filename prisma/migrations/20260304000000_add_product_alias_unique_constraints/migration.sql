-- Add unique constraints to product_aliases table
-- (aliasName must be globally unique to prevent same alias pointing to multiple products)
CREATE UNIQUE INDEX IF NOT EXISTS "product_aliases_alias_name_key" ON "product_aliases"("alias_name");
CREATE UNIQUE INDEX IF NOT EXISTS "product_aliases_product_id_alias_name_key" ON "product_aliases"("product_id", "alias_name");
