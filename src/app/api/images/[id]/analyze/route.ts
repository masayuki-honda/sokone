import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getR2SignedUrl } from "@/lib/r2";
import { analyzeImageWithSplit, OcrSourceType } from "@/lib/ocr";

// Allow longer execution on Vercel (split OCR = up to 4 sequential Gemini calls + R2 fetch)
export const maxDuration = 120;

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/images/[id]/analyze — Run OCR on an uploaded image
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getSession();
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

    // Fetch user-defined categories from DB to inject into OCR prompt
    const dbCategories = await prisma.productCategory.findMany({
      select: { name: true },
      orderBy: { displayOrder: "asc" },
    });
    const categoryNames = dbCategories.map((c) => c.name);

    // Run OCR (auto-splits large flyer images into quadrants)
    const ocrResult = await analyzeImageWithSplit(
      imageBuffer,
      "image/jpeg", // Images are always converted to JPEG during upload
      image.sourceType as OcrSourceType,
      categoryNames,
    );

    // Update the database with OCR results
    // Use `no_products` when OCR found nothing (e.g. campaign banner, non-product page)
    const hasItems = (ocrResult.items?.length ?? 0) > 0;
    const updated = await prisma.uploadedImage.update({
      where: { id },
      data: {
        ocrResultJson: ocrResult as object,
        ocrRawText: JSON.stringify(ocrResult),
        status: hasItems ? "processed" : "no_products",
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
    // Capture error details regardless of error type (SDK may throw non-Error objects)
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      // Gemini SDK sometimes throws objects with statusText, status, etc.
      const e = error as Record<string, unknown>;
      errorMessage =
        (typeof e.message === "string" ? e.message : null) ??
        (typeof e.statusText === "string" ? e.statusText : null) ??
        (typeof e.status === "number" ? `HTTP ${e.status}` : null) ??
        JSON.stringify(e).slice(0, 300);
    } else {
      errorMessage = String(error);
    }

    // Log full error details to server terminal for debugging
    console.error("[OCR] Analysis failed:", {
      errorMessage,
      errorType: typeof error,
      isErrorInstance: error instanceof Error,
      raw: error,
    });

    // Mark as failed in database
    await prisma.uploadedImage.update({
      where: { id },
      data: { status: "failed" },
    }).catch((dbErr) => {
      console.error("[OCR] Failed to update status to failed:", dbErr);
    });
    const rateLimitType =
      (error as Error & { rateLimitType?: string }).rateLimitType;
    const isRateLimit = rateLimitType != null ||
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("利用上限") ||
      errorMessage.includes("無料枠");

    return NextResponse.json(
      {
        error: isRateLimit ? errorMessage : "OCR解析に失敗しました",
        rateLimitType: rateLimitType ?? null,
        details: errorMessage || "不明なエラー（ターミナルログを確認）",
      },
      { status: isRateLimit ? 429 : 500 },
    );
  }
}
