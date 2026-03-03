/**
 * Geocoding utilities using Nominatim (OpenStreetMap) - free, no API key required.
 * Usage policy: max 1 request/second, valid User-Agent header required.
 * https://nominatim.org/release-docs/develop/api/Search/
 *
 * Note: Nominatim Japan coverage is incomplete for building-level addresses.
 * We use a progressive fallback strategy to maximize hit rate.
 */

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function nominatimSearch(
  query: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "jp");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Sokone/1.0 (https://github.com/masayuki-honda/sokone)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;

  const results: NominatimResult[] = await res.json();
  if (results.length === 0) return null;

  const latitude = parseFloat(results[0].lat);
  const longitude = parseFloat(results[0].lon);
  if (!isFinite(latitude) || !isFinite(longitude)) return null;

  console.log(`[Geocode] found: "${query}" → (${latitude}, ${longitude}) [${results[0].display_name}]`);
  return { latitude, longitude };
}

/**
 * Strip building name / floor info and trailing noise from a Japanese address.
 * e.g. "港北区新羽町１６３６－１ ビル 地下１階" → "港北区新羽町１６３６－１"
 */
function normalizeJapaneseAddress(address: string): string {
  return address
    // Remove floor/room info
    .replace(/\s+(地下?\d+階?|[0-9０-９]+階|[A-Za-z]\d*号?室?|号室?\d*).*$/u, "")
    // Remove building name after space (Japanese building names tend to follow the number)
    .replace(/\s+\S+ビル.*$/u, "")
    .replace(/\s+\S+(タワー|マンション|アパート|コーポ|ハイツ|レジデンス|プレイス).*$/u, "")
    .trim();
}

/**
 * Slice a Japanese address to the street/block level (丁目番地).
 * e.g. "神奈川県横浜市港北区大倉山３丁目５７－１５ アネシス大倉山"
 *   → "神奈川県横浜市港北区大倉山３丁目５７"
 */
function stripToBlock(address: string): string {
  // Keep up to 丁目XX, drop everything after -(番地 dash)
  const m = address.match(/^(.+?[町丁]\d+)[－\-－]\d+/u);
  return m ? m[1] : address;
}

/**
 * Geocode a Japanese address to latitude/longitude coordinates.
 * Uses progressive fallback: full address → normalized → block-level
 * Returns null if all attempts fail.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!address || address.trim().length < 3) return null;

  const candidates = [
    address.trim(),
    normalizeJapaneseAddress(address.trim()),
    stripToBlock(address.trim()),
  ].filter((v, i, arr) => v.length > 0 && arr.indexOf(v) === i); // deduplicate

  for (const query of candidates) {
    try {
      const result = await nominatimSearch(query);
      if (result) return result;
    } catch {
      // try next candidate
    }
    // Nominatim rate limit: 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log(`[Geocode] no result for: "${address}"`);
  return null;
}
