-- AlterTable
ALTER TABLE "uploaded_images" ADD COLUMN "taken_at" TIMESTAMP(3);
ALTER TABLE "uploaded_images" ADD COLUMN "gps_latitude" DOUBLE PRECISION;
ALTER TABLE "uploaded_images" ADD COLUMN "gps_longitude" DOUBLE PRECISION;
