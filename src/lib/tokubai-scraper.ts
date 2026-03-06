/**
 * Tokubai flyer scraper
 *
 * Scrapes https://tokubai.co.jp shop pages to extract current flyer image URLs.
 * Uses server-side rendered HTML + cheerio (no Playwright required).
 *
 * Flow:
 *   1. Fetch store page  → find current leaflet IDs + URLs
 *   2. For each leaflet  → fetch leaflet page → extract bargain_office_leaflets image URLs
 *   3. Return list of { leafletId, title, imageUrls }
 */

import * as cheerio from "cheerio";
import { processImage, generateImageKey } from "@/lib/image-processing";
import { uploadToR2 } from "@/lib/r2";
import { prisma } from "@/lib/prisma";

const TOKUBAI_ORIGIN = "https://tokubai.co.jp";
const SCRAPER_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const FETCH_TIMEOUT_MS = 15_000;
const INTER_REQUEST_DELAY_MS = 800; // be polite to tokubai

export interface LeafletInfo {
  leafletId: string;
  title: string;
  imageUrls: string[];
  pageUrl: string;
}

/** Pause for ms milliseconds */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch HTML with timeout and accept-language set to Japanese */
async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": SCRAPER_USER_AGENT,
        "Accept-Language": "ja, en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrape a tokubai shop page and return current leaflet information.
 *
 * @param shopUrl e.g. "https://tokubai.co.jp/ライフ/2330"
 * @param maxLeaflets maximum number of leaflets to fetch (newest first, default 1)
 */
export async function scrapeShopLeaflets(shopUrl: string, maxLeaflets = 1): Promise<LeafletInfo[]> {
  // Normalize URL: strip trailing slash
  const normalizedUrl = shopUrl.replace(/\/$/, "");

  const html = await fetchHtml(normalizedUrl);
  if (!html) {
    throw new Error(`tokubaiショップページの取得に失敗しました: ${normalizedUrl}`);
  }

  const $ = cheerio.load(html);

  // Collect unique leaflet page URLs from <a href="...leaflets/{id}">
  const leafletMap = new Map<string, { url: string; title: string }>();

  $("a[href*='/leaflets/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    // Match /leaflets/{numeric_id} at the end of the path (ignore sub-paths like /print)
    const match = href.match(/\/leaflets\/(\d+)(?:\/|$)/);
    if (!match) return;
    const leafletId = match[1];
    if (leafletMap.has(leafletId)) return;

    // Build full URL
    const fullUrl = href.startsWith("http")
      ? href.split("?")[0]
      : `${TOKUBAI_ORIGIN}${href.split("?")[0]}`;

    // Best-effort title from link text or nearby heading
    const linkText = $(el).text().trim();
    leafletMap.set(leafletId, { url: fullUrl, title: linkText });
  });

  if (leafletMap.size === 0) {
    return [];
  }

  const leaflets: LeafletInfo[] = [];
  let fetchedCount = 0;

  for (const [leafletId, { url: leafletUrl, title }] of leafletMap) {
    if (fetchedCount >= maxLeaflets) break;
    await delay(INTER_REQUEST_DELAY_MS);

    const imageUrls = await extractLeafletImages(leafletUrl);
    if (imageUrls.length > 0) {
      leaflets.push({ leafletId, title, imageUrls, pageUrl: leafletUrl });
      fetchedCount++;
    }
  }

  return leaflets;
}

/**
 * Fetch a tokubai leaflet page and extract all bargain_office_leaflets image URLs.
 * Handles multi-page flyers by iterating ?page=N until no new images are found.
 */
async function extractLeafletImages(leafletUrl: string): Promise<string[]> {
  const allImages: string[] = [];

  // Try the base URL first, then paginated versions
  for (let page = 1; page <= 20; page++) {
    const url = page === 1 ? leafletUrl : `${leafletUrl}?page=${page}`;
    if (page > 1) await delay(INTER_REQUEST_DELAY_MS);

    const html = await fetchHtml(url);
    if (!html) break;

    const $ = cheerio.load(html);
    let foundNewOnPage = false;

    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (!src.includes("image.tokubai.co.jp/images/bargain_office_leaflets")) return;
      // Strip cache-busting query strings
      const clean = src.split("?")[0];
      if (!allImages.includes(clean)) {
        allImages.push(clean);
        foundNewOnPage = true;
      }
    });

    // Stop pagination loop if no new image was found on this page
    if (!foundNewOnPage) break;
  }

  return allImages;
}

// ---------------------------------------------------------------------------
// Image download + R2 upload helper (shared with scrape API endpoint)
// ---------------------------------------------------------------------------

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB (flyer images can be large)

export interface SavedImageResult {
  uploadedImageId: string;
  imageUrl: string;
}

/**
 * Download an image from a URL, resize, upload to R2, and create an UploadedImage record.
 * Returns the created UploadedImage id.
 */
export async function downloadAndSaveImage(
  imageUrl: string,
  userId: string,
  storeId: string | null,
): Promise<SavedImageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let buffer: Buffer;
  let contentType: string;

  try {
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": SCRAPER_USER_AGENT },
    });
    if (!res.ok) throw new Error(`画像の取得に失敗 (${res.status}): ${imageUrl}`);

    contentType = res.headers.get("content-type") || "image/jpeg";
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  } finally {
    clearTimeout(timer);
  }

  if (buffer.length === 0) throw new Error("空の画像データです");
  if (buffer.length > MAX_IMAGE_SIZE) throw new Error("画像サイズが20MBを超えています");

  // Resize + convert via sharp
  const processed = await processImage(buffer, contentType);

  // Upload to R2
  const key = generateImageKey(userId, "flyer-scrape");
  await uploadToR2(key, processed.buffer, processed.contentType);

  // Persist to DB
  const uploadedImage = await prisma.uploadedImage.create({
    data: {
      userId,
      storeId,
      imageUrl: key,
      sourceType: "flyer",
      status: "pending",
    },
  });

  return { uploadedImageId: uploadedImage.id, imageUrl: key };
}
