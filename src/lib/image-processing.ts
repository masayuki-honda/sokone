import sharp from "sharp";
import exifr from "exifr";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 85;

export interface ExifMetadata {
  takenAt: Date | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
}

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  exif: ExifMetadata;
}

/**
 * Extract EXIF metadata from an image buffer.
 * Returns null values for screenshots or images without EXIF.
 */
export async function extractExifMetadata(
  inputBuffer: Buffer,
): Promise<ExifMetadata> {
  const result: ExifMetadata = {
    takenAt: null,
    gpsLatitude: null,
    gpsLongitude: null,
  };

  try {
    const exifData = await exifr.parse(inputBuffer, {
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
        "GPSLatitude",
        "GPSLongitude",
      ],
      gps: true, // auto-convert GPS to decimal degrees
    });

    if (!exifData) return result;

    // Prefer DateTimeOriginal (capture time), fallback to CreateDate, then ModifyDate
    const dateValue =
      exifData.DateTimeOriginal ?? exifData.CreateDate ?? exifData.ModifyDate;
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      result.takenAt = dateValue;
    }

    // GPS coordinates (exifr auto-converts to decimal degrees with gps:true)
    if (
      typeof exifData.latitude === "number" &&
      typeof exifData.longitude === "number" &&
      isFinite(exifData.latitude) &&
      isFinite(exifData.longitude)
    ) {
      result.gpsLatitude = exifData.latitude;
      result.gpsLongitude = exifData.longitude;
    }
  } catch {
    // EXIF parsing failure is non-critical (e.g. PNG screenshots have no EXIF)
  }

  return result;
}

/**
 * Process an uploaded image:
 * - Extract EXIF metadata before any transformation
 * - Convert HEIC to JPEG
 * - Resize to max 1600px on longest side
 * - Output as JPEG
 */
export async function processImage(
  inputBuffer: Buffer,
  _mimeType: string,
): Promise<ProcessedImage> {
  // Extract EXIF BEFORE sharp processing (sharp may strip EXIF during conversions)
  const exif = await extractExifMetadata(inputBuffer);

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
    exif,
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
export function generateImageKey(userId: string, _originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = "jpg"; // Always JPEG after processing
  return `uploads/${userId}/${timestamp}-${randomSuffix}.${extension}`;
}
