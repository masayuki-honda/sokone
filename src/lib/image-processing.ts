import sharp from "sharp";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 85;

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Process an uploaded image:
 * - Convert HEIC to JPEG
 * - Resize to max 1600px on longest side
 * - Output as JPEG
 */
export async function processImage(
  inputBuffer: Buffer,
  mimeType: string,
): Promise<ProcessedImage> {
  let pipeline = sharp(inputBuffer);

  // Get original metadata
  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Rotate based on EXIF orientation
  pipeline = pipeline.rotate();

  // Resize if necessary (keep aspect ratio)
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Convert to JPEG
  const outputBuffer = await pipeline
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  // Get final dimensions
  const outputMetadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    contentType: "image/jpeg",
    width: outputMetadata.width ?? 0,
    height: outputMetadata.height ?? 0,
  };
}

/**
 * Validate that the file is an accepted image type
 */
export function isValidImageType(mimeType: string): boolean {
  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
  ];
  return validTypes.includes(mimeType.toLowerCase());
}

/**
 * Generate a unique key for R2 storage
 */
export function generateImageKey(userId: string, originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = "jpg"; // Always JPEG after processing
  return `uploads/${userId}/${timestamp}-${randomSuffix}.${extension}`;
}
