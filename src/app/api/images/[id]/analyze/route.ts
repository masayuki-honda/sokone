import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2SignedUrl } from "@/lib/r2";
import { analyzeImage, OcrSourceType } from "@/lib/ocr";

// Allow longer execution on Vercel (Gemini API + R2 fetch can take time)
export const maxDuration = 30;

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/images/[id]/analyze — Run OCR on an uploaded image
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Find the image
  const image = await prisma.uploadedImage.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!image) {
    return NextResponse.json(
      { error: "画像が見つかりません" },
      { status: 404 },
    );
  }

  // Check if already processed
  if (image.status === "processed" && image.ocrResultJson) {
    return NextResponse.json({
      id: image.id,
      status: image.status,
      ocrResult: image.ocrResultJson,
      message: "この画像は既に解析済みです",
    });
  }

  try {
    // Download image from R2 via signed URL
    const signedUrl = await getR2SignedUrl(image.imageUrl);
    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image from R2: ${response.status}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Run OCR
    const ocrResult = await analyzeImage(
      imageBuffer,
      "image/jpeg", // Images are always converted to JPEG during upload
      image.sourceType as OcrSourceType,
    );

    // Update the database with OCR results
    const updated = await prisma.uploadedImage.update({
      where: { id },
      data: {
        ocrResultJson: ocrResult as object,
        ocrRawText: JSON.stringify(ocrResult),
        status: "processed",
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      ocrResult,
      itemCount: ocrResult.items?.length ?? 0,
      signedUrl,
      takenAt: image.takenAt,
    });
  } catch (error) {
    console.error("OCR analysis error:", error);

    // Mark as failed in database
    await prisma.uploadedImage.update({
      where: { id },
      data: { status: "failed" },
    });

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const rateLimitType =
      (error as Error & { rateLimitType?: string }).rateLimitType;
    const isRateLimit = rateLimitType != null ||
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("利用上限");

    return NextResponse.json(
      {
        error: isRateLimit ? errorMessage : "OCR解析に失敗しました",
        rateLimitType: rateLimitType ?? null,
        details: errorMessage,
      },
      { status: isRateLimit ? 429 : 500 },
    );
  }
}
