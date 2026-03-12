import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { findOrCreateProduct, normalizeProductName } from "@/lib/product-matcher";
import { SourceType } from "@prisma/client";
import { createNotification } from "@/lib/notification";
import { calculateUnitPriceForStorage } from "@/lib/unit-price";

interface PriceItem {
  name: string;
  price: number;
  unit?: string | null;
  volume?: string | null;
  category_hint?: string | null;
  is_tax_included?: boolean;
  productId?: string; // If already matched to existing product
}

interface BulkPriceRequest {
  items: PriceItem[];
  storeId: string;
  sourceType: SourceType;
  sourceImageId?: string;
  recordedAt?: string;
}

/**
 * POST /api/prices/bulk — Register prices from OCR results
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as BulkPriceRequest;
    const { items, storeId, sourceType, sourceImageId, recordedAt } = body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "商品リストは必須です" },
        { status: 400 },
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: "店舗を選択してください" },
        { status: 400 },
      );
    }

    // Validate source type
    const validSourceTypes: SourceType[] = [
      "photo",
      "flyer",
      "instagram",
      "receipt",
    ];
    if (!sourceType || !validSourceTypes.includes(sourceType)) {
      return NextResponse.json(
        { error: "無効なソースタイプです" },
        { status: 400 },
      );
    }

    // Validate store ownership
    const store = await prisma.store.findFirst({
      where: { id: storeId, userId: session.user.id },
    });

    if (!store) {
      return NextResponse.json(
        { error: "指定された店舗が見つかりません" },
        { status: 400 },
      );
    }

    // Validate source image if provided
    if (sourceImageId) {
      const image = await prisma.uploadedImage.findFirst({
        where: { id: sourceImageId, userId: session.user.id },
      });
      if (!image) {
        return NextResponse.json(
          { error: "指定された画像が見つかりません" },
          { status: 400 },
        );
      }
    }

    const recorded = recordedAt ? new Date(recordedAt) : new Date();
    const results = [];
    const errors = [];

    // Process each item in a transaction
    for (const item of items) {
      try {
        if (!item.name || item.price == null || item.price <= 0) {
          errors.push({
            name: item.name || "(不明)",
            error: "商品名と正の価格は必須です",
          });
          continue;
        }

        // Find or create product
        let productId = item.productId;
        let isNewProduct = false;

        if (!productId) {
          const product = await findOrCreateProduct(item.name, {
            categoryHint: item.category_hint,
            unit: item.unit,
            volume: item.volume,
          });
          productId = product.id;
          isNewProduct = product.isNew;
        } else {
          // User manually linked an OCR-extracted name to an existing product.
          // Auto-register the OCR name as an alias so future scans match automatically.
          const aliasName = normalizeProductName(item.name);
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { normalizedName: true },
          });
          if (product && product.normalizedName !== aliasName) {
            const existing = await prisma.productAlias.findFirst({
              where: { aliasName },
            });
            if (!existing) {
              await prisma.productAlias.create({
                data: { productId, aliasName },
              });
            }
          }
        }

        // Ensure price is tax-included integer
        let finalPrice = Math.round(item.price);
        if (item.is_tax_included === false) {
          finalPrice = Math.round(item.price * 1.1); // 10% tax
        }

        // Calculate unit price from product's volume/unit info
        const productForUnit = await prisma.product.findUnique({
          where: { id: productId },
          select: { volume: true, unit: true },
        });
        const unitPrice = calculateUnitPriceForStorage(
          finalPrice,
          productForUnit?.volume ?? item.volume,
          productForUnit?.unit ?? item.unit,
        );

        // Create price record
        const priceRecord = await prisma.priceRecord.create({
          data: {
            productId,
            storeId,
            userId: session.user.id,
            price: finalPrice,
            unitPrice,
            taxIncluded: true,
            sourceType,
            sourceImageId: sourceImageId || null,
            recordedAt: recorded,
          },
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        });

        // Check if this price is a deal (near bottom price)
        const bottomRecord = await prisma.priceRecord.findFirst({
          where: { productId },
          orderBy: { price: "asc" },
          select: { price: true },
        });
        const bottomPrice = bottomRecord?.price ?? finalPrice;
        const isDeal = finalPrice <= bottomPrice * 1.1;

        // --- Notification triggers ---
        // Check if any user is watching this product
        const watches = await prisma.priceWatch.findMany({
          where: { productId, enabled: true },
          select: { userId: true, targetPrice: true },
        });

        const productName = priceRecord.product.name;
        const storeName = store.name;

        for (const watch of watches) {
          // Bottom price update: current price is the new lowest
          if (finalPrice === bottomPrice) {
            await createNotification({
              userId: watch.userId,
              type: "bottom_price_update",
              title: `${productName}の底値更新！`,
              body: `${storeName}で ¥${finalPrice.toLocaleString()} — 底値が更新されました`,
              data: { productId, storeId, priceRecordId: priceRecord.id, price: finalPrice },
            });
          }

          // Target price reached
          if (watch.targetPrice && finalPrice <= watch.targetPrice) {
            await createNotification({
              userId: watch.userId,
              type: "watch_target_reached",
              title: `${productName}が目標価格以下！`,
              body: `${storeName}で ¥${finalPrice.toLocaleString()}（目標: ¥${watch.targetPrice.toLocaleString()}）`,
              data: { productId, storeId, priceRecordId: priceRecord.id, price: finalPrice, targetPrice: watch.targetPrice },
            });
          }

          // Deal alert (only if not already covered by bottom price or target)
          if (isDeal && finalPrice !== bottomPrice && (!watch.targetPrice || finalPrice > watch.targetPrice)) {
            await createNotification({
              userId: watch.userId,
              type: "deal_alert",
              title: `${productName}がお買い得！`,
              body: `${storeName}で ¥${finalPrice.toLocaleString()}（底値: ¥${bottomPrice.toLocaleString()}）`,
              data: { productId, storeId, priceRecordId: priceRecord.id, price: finalPrice, bottomPrice },
            });
          }
        }

        results.push({
          priceRecordId: priceRecord.id,
          productId: priceRecord.productId,
          productName: priceRecord.product.name,
          price: priceRecord.price,
          isNewProduct,
          isDeal,
          bottomPrice,
        });
      } catch (itemError) {
        console.error(`Error processing item ${item.name}:`, itemError);
        errors.push({
          name: item.name,
          error: "価格の登録に失敗しました",
        });
      }
    }

    // Back-fill storeId on the source image so the lightbox shows the store correctly
    if (sourceImageId && results.length > 0) {
      await prisma.uploadedImage.updateMany({
        where: { id: sourceImageId, userId: session.user.id, storeId: null },
        data: { storeId },
      });
    }

    return NextResponse.json(
      {
        registered: results,
        errors,
        summary: {
          total: items.length,
          success: results.length,
          failed: errors.length,
          newProducts: results.filter((r) => r.isNewProduct).length,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Bulk price registration error:", error);
    return NextResponse.json(
      { error: "価格登録中にエラーが発生しました" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/prices — List price records with filters
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const storeId = searchParams.get("storeId");
  const sourceType = searchParams.get("sourceType");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
  const cursor = searchParams.get("cursor");

  const where = {
    userId: session.user.id,
    ...(productId && { productId }),
    ...(storeId && { storeId }),
    ...(sourceType && {
      sourceType: sourceType as SourceType,
    }),
    ...(from || to
      ? {
          recordedAt: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }
      : {}),
  };

  const records = await prisma.priceRecord.findMany({
    where,
    orderBy: { recordedAt: "desc" },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    include: {
      product: {
        select: { id: true, name: true, normalizedName: true },
      },
      store: {
        select: { id: true, name: true },
      },
    },
  });

  const hasMore = records.length > limit;
  const result = hasMore ? records.slice(0, limit) : records;
  const nextCursor = hasMore ? result[result.length - 1].id : null;

  return NextResponse.json({
    records: result,
    nextCursor,
    hasMore,
  });
}
