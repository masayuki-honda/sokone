import { prisma } from "@/lib/prisma";
import { scrapeShopLeaflets, downloadAndSaveImage } from "@/lib/tokubai-scraper";
import { analyzeImageWithSplit, OcrSourceType } from "@/lib/ocr";
import { getR2SignedUrl } from "@/lib/r2";
import { findOrCreateProduct, findProductOnly } from "@/lib/product-matcher";
import { createNotification } from "@/lib/notification";
import { calculateUnitPriceForStorage } from "@/lib/unit-price";
import crypto from "crypto";

const MIN_CONFIDENCE = 0.7;
const INTER_OCR_DELAY_MS = 4500; // ~13 req/min (Gemini limit: 15/min)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PipelineResult {
  jobId: string;
  imagesScraped: number;
  imagesOcred: number;
  pricesRegistered: number;
  pendingReviews: number;
  errors: string[];
}

/**
 * Run the full scrape → OCR → price registration pipeline for a store.
 * This function is designed to be called from an API endpoint (long-running).
 */
export async function runScrapingPipeline(
  storeId: string,
  userId: string,
): Promise<PipelineResult> {
  // Create job record
  const job = await prisma.scrapingJob.create({
    data: {
      storeId,
      userId,
      status: "running",
      startedAt: new Date(),
    },
  });

  const errors: string[] = [];
  let imagesScraped = 0;
  let imagesOcred = 0;
  let pricesRegistered = 0;
  let pendingReviews = 0;

  try {
    // 1. Get store + tokubai URL
    const store = await prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { scrapedLeaflets: true },
    });

    if (!store.tokubaiShopUrl) {
      throw new Error("tokubai URL が設定されていません");
    }

    // 2. Scrape leaflets
    const leaflets = await scrapeShopLeaflets(store.tokubaiShopUrl, 5);
    const alreadyScrapedIds = new Set(
      store.scrapedLeaflets.map((l) => l.leafletId)
    );
    const newLeaflets = leaflets.filter(
      (l) => !alreadyScrapedIds.has(l.leafletId)
    );

    if (newLeaflets.length === 0) {
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { status: "completed", completedAt: new Date() },
      });
      return { jobId: job.id, imagesScraped: 0, imagesOcred: 0, pricesRegistered: 0, pendingReviews: 0, errors: [] };
    }

    // 3. Download images
    const imageIds: string[] = [];
    // Deduplicate image URLs across all leaflets to avoid downloading the same
    // campaign banner image that appears in multiple leaflet IDs.
    const seenImageUrls = new Set<string>();
    for (const leaflet of newLeaflets) {
      let savedCount = 0;
      for (const imageUrl of leaflet.imageUrls) {
        if (seenImageUrls.has(imageUrl)) continue;
        seenImageUrls.add(imageUrl);
        try {
          const result = await downloadAndSaveImage(imageUrl, userId, storeId);
          imageIds.push(result.uploadedImageId);
          savedCount++;
          imagesScraped++;
        } catch (err) {
          errors.push(`DL: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      // Record leaflet as scraped
      await prisma.scrapedLeaflet.upsert({
        where: { storeId_leafletId: { storeId, leafletId: leaflet.leafletId } },
        create: { storeId, leafletId: leaflet.leafletId, title: leaflet.title || null, pageCount: savedCount },
        update: { title: leaflet.title || undefined, pageCount: savedCount, scrapedAt: new Date() },
      });
    }

    // Update job progress
    await prisma.scrapingJob.update({
      where: { id: job.id },
      data: { imagesScraped },
    });

    // 4. OCR each image
    const categoryNames = (
      await prisma.productCategory.findMany({
        select: { name: true },
        orderBy: { displayOrder: "asc" },
      })
    ).map((c) => c.name);

    for (const imageId of imageIds) {
      try {
        const image = await prisma.uploadedImage.findUnique({ where: { id: imageId } });
        if (!image || image.status === "processed") continue;

        // Download from R2
        const signedUrl = await getR2SignedUrl(image.imageUrl);
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`R2 fetch failed: ${res.status}`);
        const imageBuffer = Buffer.from(await res.arrayBuffer());

        // Duplicate detection via file hash
        const fileHash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
        const existingByHash = await prisma.uploadedImage.findFirst({
          where: { fileHash, id: { not: imageId }, status: "processed" },
          select: { id: true },
        });
        if (existingByHash) {
          // Skip duplicate — mark as processed to avoid re-processing
          await prisma.uploadedImage.update({
            where: { id: imageId },
            data: { fileHash, status: "processed" },
          });
          continue;
        }

        // Save hash for future dedup
        await prisma.uploadedImage.update({
          where: { id: imageId },
          data: { fileHash },
        });

        // Run OCR
        const ocrResult = await analyzeImageWithSplit(
          imageBuffer,
          "image/jpeg",
          image.sourceType as OcrSourceType,
          categoryNames,
        );

        // Update image with OCR result
        // Use `no_products` when OCR found nothing — avoids polluting the gallery
        // with campaign banners / non-product flyer pages.
        const hasItems = (ocrResult.items?.length ?? 0) > 0;
        await prisma.uploadedImage.update({
          where: { id: imageId },
          data: {
            ocrResultJson: ocrResult as object,
            ocrRawText: JSON.stringify(ocrResult),
            status: hasItems ? "processed" : "no_products",
          },
        });
        imagesOcred++;

        // 5. Register prices from OCR results (auto — high confidence only)
        const highConfItems = (ocrResult.items || []).filter(
          (item) => item.confidence >= MIN_CONFIDENCE && item.price > 0
        );

        for (const item of highConfItems) {
          try {
            let finalPrice = Math.round(item.price);
            if (!item.is_tax_included) {
              finalPrice = Math.round(item.price * 1.1);
            }

            // For auto-flyer: only register price for products already in the catalog.
            // Unknown products go to PendingReview so the catalog stays clean.
            const product = await findProductOnly(item.name, {
              unit: item.unit,
              volume: item.volume,
            });

            if (!product) {
              // New product — route to PendingReview instead of auto-creating
              await prisma.pendingReview.create({
                data: {
                  userId,
                  storeId,
                  sourceImageId: imageId,
                  jobId: job.id,
                  productName: item.name,
                  price: finalPrice,
                  confidence: item.confidence,
                  categoryHint: item.category_hint || null,
                  unit: item.unit || null,
                  volume: item.volume || null,
                },
              }).catch(() => {}); // ignore duplicate errors
              pendingReviews++;
              continue;
            }

            const unitPrice = calculateUnitPriceForStorage(
              finalPrice,
              product.volume ?? item.volume,
              product.unit ?? item.unit,
            );

            await prisma.priceRecord.create({
              data: {
                productId: product.id,
                storeId,
                userId,
                price: finalPrice,
                unitPrice,
                taxIncluded: true,
                sourceType: "auto_flyer",
                sourceImageId: imageId,
                recordedAt: new Date(),
              },
            });
            pricesRegistered++;

            // Check PriceWatch and send notifications
            const watches = await prisma.priceWatch.findMany({
              where: { productId: product.id, enabled: true },
              select: { userId: true, targetPrice: true },
            });

            if (watches.length > 0) {
              const bottomRecord = await prisma.priceRecord.findFirst({
                where: { productId: product.id },
                orderBy: { price: "asc" },
                select: { price: true },
              });
              const bottomPrice = bottomRecord?.price ?? finalPrice;

              for (const watch of watches) {
                if (finalPrice === bottomPrice) {
                  await createNotification({
                    userId: watch.userId,
                    type: "bottom_price_update",
                    title: `${item.name}の底値更新！`,
                    body: `${store.name}で ¥${finalPrice.toLocaleString()} — 自動チラシ取得`,
                    data: { productId: product.id, storeId, price: finalPrice },
                  });
                }
                if (watch.targetPrice && finalPrice <= watch.targetPrice) {
                  await createNotification({
                    userId: watch.userId,
                    type: "watch_target_reached",
                    title: `${item.name}が目標価格以下！`,
                    body: `${store.name}で ¥${finalPrice.toLocaleString()}（目標: ¥${watch.targetPrice.toLocaleString()}）`,
                    data: { productId: product.id, storeId, price: finalPrice, targetPrice: watch.targetPrice },
                  });
                }
              }
            }
          } catch (priceErr) {
            errors.push(`Price: ${item.name}: ${priceErr instanceof Error ? priceErr.message : String(priceErr)}`);
          }
        }

        // 5b. Save low-confidence items to pending review queue
        const lowConfItems = (ocrResult.items || []).filter(
          (item) => item.confidence < MIN_CONFIDENCE && item.confidence > 0 && item.price > 0
        );

        for (const item of lowConfItems) {
          try {
            await prisma.pendingReview.create({
              data: {
                userId,
                storeId,
                sourceImageId: imageId,
                jobId: job.id,
                productName: item.name,
                price: Math.round(item.price),
                confidence: item.confidence,
                categoryHint: item.category_hint || null,
                unit: item.unit || null,
                volume: item.volume || null,
                isTaxIncluded: item.is_tax_included !== false,
              },
            });
            pendingReviews++;
          } catch (reviewErr) {
            errors.push(`Review: ${item.name}: ${reviewErr instanceof Error ? reviewErr.message : String(reviewErr)}`);
          }
        }

        // Update job progress
        await prisma.scrapingJob.update({
          where: { id: job.id },
          data: { imagesOcred, pricesRegistered },
        });

        // Rate limit between OCR calls
        await delay(INTER_OCR_DELAY_MS);
      } catch (ocrErr) {
        errors.push(`OCR: ${ocrErr instanceof Error ? ocrErr.message : String(ocrErr)}`);
        // Mark image as failed
        await prisma.uploadedImage.update({
          where: { id: imageId },
          data: { status: "failed" },
        }).catch(() => {});
      }
    }

    // 6. Complete job
    await prisma.scrapingJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        imagesScraped,
        imagesOcred,
        pricesRegistered,
        errorLog: errors.length > 0 ? errors.join("\n") : null,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);
    await prisma.scrapingJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        imagesScraped,
        imagesOcred,
        pricesRegistered,
        errorLog: errors.join("\n"),
      },
    });
  }

  return { jobId: job.id, imagesScraped, imagesOcred, pricesRegistered, pendingReviews, errors };
}
