import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";
import { processImage, generateImageKey } from "@/lib/image-processing";
import { SourceType } from "@prisma/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT = 15000; // 15 seconds

/**
 * Check if a hostname resolves to a private/internal IP
 * (Basic SSRF protection)
 */
function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block private/internal hostnames
    const blockedPatterns = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^0\./,
      /^169\.254\./, // Link-local
      /^fc00:/i, // IPv6 unique local
      /^fe80:/i, // IPv6 link-local
      /^::1$/, // IPv6 loopback
      /^0:0:0:0:0:0:0:1$/,
      /\.local$/,
      /\.internal$/,
    ];

    return blockedPatterns.some((pattern) => pattern.test(hostname));
  } catch {
    return true; // Block invalid URLs
  }
}

/**
 * POST /api/images/from-url — Fetch image from URL and upload
 * Body:
 * - url: string — Image URL to fetch
 * - sourceType: photo | flyer | instagram | receipt
 * - storeId: (optional) store ID to associate
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, sourceType, storeId } = body;

    // Validate URL
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URLを指定してください" },
        { status: 400 },
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "無効なURLです" },
        { status: 400 },
      );
    }

    // Only allow http and https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "HTTPまたはHTTPSのURLを指定してください" },
        { status: 400 },
      );
    }

    // SSRF protection
    if (isPrivateUrl(url)) {
      return NextResponse.json(
        { error: "プライベートネットワーク上のURLは指定できません" },
        { status: 400 },
      );
    }

    // Validate source type
    const validSourceTypes: SourceType[] = ["photo", "flyer", "instagram", "receipt"];
    if (!sourceType || !validSourceTypes.includes(sourceType)) {
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

    // Fetch the image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Sokone/1.0 (Image Fetcher)",
        },
        redirect: "follow",
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "画像の取得がタイムアウトしました" },
          { status: 408 },
        );
      }
      return NextResponse.json(
        { error: "URLから画像を取得できませんでした" },
        { status: 400 },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `画像の取得に失敗しました（ステータス: ${response.status}）` },
        { status: 400 },
      );
    }

    // Validate content type
    const contentType = response.headers.get("content-type") || "";
    const isImage = contentType.startsWith("image/");

    if (!isImage) {
      // Try to check if the URL has an image extension
      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"];
      const urlPath = parsedUrl.pathname.toLowerCase();
      const hasImageExtension = imageExtensions.some((ext) =>
        urlPath.endsWith(ext),
      );

      if (!hasImageExtension) {
        return NextResponse.json(
          { error: "指定されたURLは画像ではないようです" },
          { status: 400 },
        );
      }
    }

    // Read the response body
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Check file size
    if (inputBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "画像サイズが10MBを超えています" },
        { status: 400 },
      );
    }

    if (inputBuffer.length === 0) {
      return NextResponse.json(
        { error: "画像データが空です" },
        { status: 400 },
      );
    }

    // Process image
    const processed = await processImage(inputBuffer, contentType);

    // Upload to R2
    const key = generateImageKey(session.user.id, "from-url");
    await uploadToR2(key, processed.buffer, processed.contentType);

    // Save to database
    const uploadedImage = await prisma.uploadedImage.create({
      data: {
        userId: session.user.id,
        storeId: storeId || null,
        imageUrl: key,
        sourceType: sourceType as SourceType,
        status: "pending",
      },
    });

    return NextResponse.json(
      {
        id: uploadedImage.id,
        imageUrl: key,
        sourceType: uploadedImage.sourceType,
        status: uploadedImage.status,
        createdAt: uploadedImage.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("From-URL error:", error);
    return NextResponse.json(
      { error: "画像の取得中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
