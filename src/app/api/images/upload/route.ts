import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";
import {
  processImage,
  isValidImageType,
  generateImageKey,
} from "@/lib/image-processing";
import { SourceType } from "@prisma/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Allow longer execution on Vercel (sharp processing + R2 upload)
export const maxDuration = 30;

const VALID_SOURCE_TYPES: SourceType[] = ["photo", "flyer", "instagram", "receipt"];

/**
 * POST /api/images/upload — Upload images
 * Accepts multipart/form-data with:
 * - files: one or more image files
 * - sourceType: photo | flyer | instagram | receipt
 * - storeId: (optional) store ID to associate
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const sourceType = formData.get("sourceType") as string;
    const storeId = formData.get("storeId") as string | null;

    // Validate source type
    if (!sourceType || !VALID_SOURCE_TYPES.includes(sourceType as SourceType)) {
      return NextResponse.json(
        { error: "ソースタイプは photo, flyer, instagram, receipt のいずれかを指定してください" },
        { status: 400 },
      );
    }

    // Validate store if provided
    if (storeId) {
      const store = await prisma.store.findFirst({
        where: { id: storeId, userId: session.user.id },
      });
      if (!store) {
        return NextResponse.json(
          { error: "指定された店舗が見つかりません" },
          { status: 400 },
        );
      }
    }

    // Get all uploaded files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "画像ファイルを選択してください" },
        { status: 400 },
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "一度にアップロードできるのは10枚までです" },
        { status: 400 },
      );
    }

    const results = [];
    const errors = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      try {
        // Validate file type
        if (!isValidImageType(file.type)) {
          errors.push({
            name: file.name,
            error: "対応していない画像形式です（JPEG, PNG, HEIC, WebP に対応）",
          });
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push({
            name: file.name,
            error: "ファイルサイズが10MBを超えています",
          });
          continue;
        }

        // Read file into buffer
        const arrayBuffer = await file.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        // Process image (resize, convert to JPEG)
        const processed = await processImage(inputBuffer, file.type);

        // Generate R2 key and upload
        const key = generateImageKey(session.user.id, file.name);
        await uploadToR2(key, processed.buffer, processed.contentType);

        // GPS fallback: if Canvas compression stripped EXIF, use client-extracted coordinates
        let gpsLatitude = processed.exif.gpsLatitude;
        let gpsLongitude = processed.exif.gpsLongitude;
        if (gpsLatitude === null) {
          const clientLat = formData.get(`gps_client_lat_${fileIndex}`);
          const clientLng = formData.get(`gps_client_lng_${fileIndex}`);
          if (clientLat && clientLng) {
            const parsedLat = parseFloat(String(clientLat));
            const parsedLng = parseFloat(String(clientLng));
            if (isFinite(parsedLat) && isFinite(parsedLng)) {
              gpsLatitude = parsedLat;
              gpsLongitude = parsedLng;
              console.log(`[Upload] GPS restored from client fallback for file ${fileIndex}: (${gpsLatitude}, ${gpsLongitude})`);
            }
          }
        }

        // Save to database (including EXIF metadata)
        const uploadedImage = await prisma.uploadedImage.create({
          data: {
            userId: session.user.id,
            storeId: storeId || null,
            imageUrl: key,
            sourceType: sourceType as SourceType,
            status: "pending",
            takenAt: processed.exif.takenAt,
            gpsLatitude,
            gpsLongitude,
          },
        });

        console.log(`[Upload] image saved: id=${uploadedImage.id} gps=(${gpsLatitude}, ${gpsLongitude}) takenAt=${processed.exif.takenAt}`);

        results.push({
          id: uploadedImage.id,
          imageUrl: key,
          sourceType: uploadedImage.sourceType,
          status: uploadedImage.status,
          createdAt: uploadedImage.createdAt,
          takenAt: uploadedImage.takenAt,
          gpsLatitude: uploadedImage.gpsLatitude,
          gpsLongitude: uploadedImage.gpsLongitude,
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        errors.push({
          name: file.name,
          error: "画像の処理中にエラーが発生しました",
        });
      }
    }

    return NextResponse.json(
      {
        uploaded: results,
        errors,
        summary: {
          total: files.length,
          success: results.length,
          failed: errors.length,
        },
      },
      { status: results.length > 0 ? 201 : 400 },
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "アップロード中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
