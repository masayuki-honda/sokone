-- Add no_products value to ImageStatus enum
ALTER TYPE "ImageStatus" ADD VALUE IF NOT EXISTS 'no_products';
