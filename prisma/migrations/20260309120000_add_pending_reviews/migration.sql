-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "pending_reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "source_image_id" TEXT NOT NULL,
    "job_id" TEXT,
    "product_name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "category_hint" TEXT,
    "unit" TEXT,
    "volume" TEXT,
    "is_tax_included" BOOLEAN NOT NULL DEFAULT true,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "pending_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_reviews_user_id_status_idx" ON "pending_reviews"("user_id", "status");

-- AddForeignKey
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_source_image_id_fkey" FOREIGN KEY ("source_image_id") REFERENCES "uploaded_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scraping_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
