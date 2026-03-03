/**
 * Geocoding utilities using Nominatim (OpenStreetMap) - free, no API key required.
 * Usage policy: max 1 request/second, valid User-Agent header required.
 * https://nominatim.org/release-docs/develop/api/Search/
 */

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Geocode a Japanese address to latitude/longitude coordinates.
 * Returns null if geocoding fails or no results found.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!address || address.trim().length < 3) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address.trim());
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "jp");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Sokone/1.0 (https://github.com/masayuki-honda/sokone)",
        Accept: "application/json",
      },
      // 5 second timeout to avoid blocking store creation
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const results: NominatimResult[] = await res.json();
    if (results.length === 0) return null;

    const { lat, lon } = results[0];
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (!isFinite(latitude) || !isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    // Geocoding is best-effort; don't block store creation
    return null;
  }
}
