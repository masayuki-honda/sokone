-- Add file_hash column to uploaded_images for client-side duplicate detection
ALTER TABLE "uploaded_images" ADD COLUMN "file_hash" TEXT;
CREATE INDEX "uploaded_images_file_hash_idx" ON "uploaded_images"("user_id", "file_hash");
