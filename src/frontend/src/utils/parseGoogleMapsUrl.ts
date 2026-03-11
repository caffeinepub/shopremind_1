export interface ParsedMapLocation {
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  isShortLink: boolean;
  error: string | null;
}

const empty = (): ParsedMapLocation => ({
  latitude: null,
  longitude: null,
  placeName: null,
  isShortLink: false,
  error: null,
});

/** Detect plain coordinate pair "40.7128,-74.0060" */
function isPlainCoords(input: string): boolean {
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(input.trim());
}

/** Extract coordinates using all known Google Maps URL patterns */
function extractCoordsFromString(
  text: string,
): { lat: number; lng: number } | null {
  // @lat,lng format (most common in full URLs)
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch)
    return {
      lat: Number.parseFloat(atMatch[1]),
      lng: Number.parseFloat(atMatch[2]),
    };

  // !3d{lat}!4d{lng} format (mobile share links data param)
  const d3dMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d3dMatch)
    return {
      lat: Number.parseFloat(d3dMatch[1]),
      lng: Number.parseFloat(d3dMatch[2]),
    };

  // !4d{lng} followed anywhere by !3d{lat} (reversed order)
  const d4dMatch = text.match(/!4d(-?\d+\.\d+).*?!3d(-?\d+\.\d+)/);
  if (d4dMatch)
    return {
      lng: Number.parseFloat(d4dMatch[1]),
      lat: Number.parseFloat(d4dMatch[2]),
    };

  // /maps/@lat,lng or /maps/place/Name/@lat,lng
  const pathMatch = text.match(
    /\/maps\/(?:place\/[^/]+\/)?@(-?\d+\.\d+),(-?\d+\.\d+)/,
  );
  if (pathMatch)
    return {
      lat: Number.parseFloat(pathMatch[1]),
      lng: Number.parseFloat(pathMatch[2]),
    };

  // destination=lat,lng or origin=lat,lng or query=lat,lng or q=lat,lng
  const destMatch = text.match(
    /[?&](?:destination|origin|query|q)=(-?\d+\.\d+),(-?\d+\.\d+)/,
  );
  if (destMatch)
    return {
      lat: Number.parseFloat(destMatch[1]),
      lng: Number.parseFloat(destMatch[2]),
    };

  // ll=lat,lng
  const llMatch = text.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch)
    return {
      lat: Number.parseFloat(llMatch[1]),
      lng: Number.parseFloat(llMatch[2]),
    };

  // center=lat,lng
  const centerMatch = text.match(/[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (centerMatch)
    return {
      lat: Number.parseFloat(centerMatch[1]),
      lng: Number.parseFloat(centerMatch[2]),
    };

  // sll=lat,lng (older maps format)
  const sllMatch = text.match(/[?&]sll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (sllMatch)
    return {
      lat: Number.parseFloat(sllMatch[1]),
      lng: Number.parseFloat(sllMatch[2]),
    };

  // coords in path like /maps/place/Name/lat,lng
  const pathCoordsMatch = text.match(
    /\/(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
  );
  if (pathCoordsMatch) {
    const lat = Number.parseFloat(pathCoordsMatch[1]);
    const lng = Number.parseFloat(pathCoordsMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/** Extract place name from a Google Maps URL or HTML body */
function extractPlaceName(text: string): string | null {
  // /maps/place/NAME/@...
  const placeMatch = text.match(/\/maps\/place\/([^/@?#]+)/);
  if (placeMatch) {
    try {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).replace(
        /-/g,
        " ",
      );
    } catch {
      return placeMatch[1];
    }
  }
  // From title tag in HTML
  const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    return titleMatch[1].replace(/ - Google Maps$/, "").trim();
  }
  return null;
}

/** Parse a full Google Maps URL synchronously -- no network needed */
function parseFullUrl(url: string): ParsedMapLocation {
  const result = empty();

  try {
    const decoded = decodeURIComponent(url);
    const coords =
      extractCoordsFromString(url) || extractCoordsFromString(decoded);
    if (coords) {
      result.latitude = coords.lat;
      result.longitude = coords.lng;
      result.placeName = extractPlaceName(decoded) || extractPlaceName(url);
      return result;
    }

    const parsed = new URL(url);
    const cidParam = parsed.searchParams.get("cid");
    const queryParam =
      parsed.searchParams.get("q") || parsed.searchParams.get("query");

    if (cidParam) {
      result.error =
        "This link doesn't contain coordinates. In Google Maps, tap on the store, then tap 'Share' and copy the link.";
      return result;
    }

    if (queryParam) {
      const coordMatch = queryParam.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        result.latitude = Number.parseFloat(coordMatch[1]);
        result.longitude = Number.parseFloat(coordMatch[2]);
        return result;
      }
      result.placeName = queryParam.replace(/\+/g, " ");
      result.error =
        "This link has a place name but no coordinates. Tap the store pin in Google Maps, then tap Share to get the correct link.";
      return result;
    }

    result.error =
      "Couldn't read coordinates from this link. Try: tap the store in Google Maps \u2192 Share \u2192 copy the link.";
    return result;
  } catch {
    result.error = "Invalid URL. Please paste a valid Google Maps link.";
    return result;
  }
}

/**
 * Extract coordinates from a proxy response's HTML body + final URL.
 * Tries many patterns: og:url, canonical, meta refresh, JS redirect,
 * any embedded Google Maps URL, and raw coordinate scan.
 */
function extractCoordsFromHtml(
  body: string,
  finalUrl: string,
): { lat: number; lng: number; placeName: string | null } | null {
  // 1. Try coords from the resolved final URL first
  if (finalUrl) {
    const fromUrl = extractCoordsFromString(finalUrl);
    if (fromUrl) {
      return {
        lat: fromUrl.lat,
        lng: fromUrl.lng,
        placeName: extractPlaceName(finalUrl) || extractPlaceName(body),
      };
    }
  }

  // 2. og:url meta tag
  const ogUrlMatch =
    body.match(
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    ) ||
    body.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i,
    );
  if (ogUrlMatch) {
    const coords = extractCoordsFromString(ogUrlMatch[1]);
    if (coords)
      return {
        lat: coords.lat,
        lng: coords.lng,
        placeName: extractPlaceName(ogUrlMatch[1]) || extractPlaceName(body),
      };
  }

  // 3. Canonical link tag
  const canonicalMatch =
    body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    body.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (canonicalMatch) {
    const coords = extractCoordsFromString(canonicalMatch[1]);
    if (coords)
      return {
        lat: coords.lat,
        lng: coords.lng,
        placeName:
          extractPlaceName(canonicalMatch[1]) || extractPlaceName(body),
      };
  }

  // 4. Meta refresh redirect
  const metaRefreshMatch = body.match(/content=["'][^"']*url=([^"'&\s]+)/i);
  if (metaRefreshMatch) {
    const redirectUrl = decodeURIComponent(metaRefreshMatch[1]);
    const coords = extractCoordsFromString(redirectUrl);
    if (coords)
      return {
        lat: coords.lat,
        lng: coords.lng,
        placeName: extractPlaceName(redirectUrl) || extractPlaceName(body),
      };
  }

  // 5. JavaScript redirect patterns
  const jsRedirectPatterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/,
    /location\.replace\(["']([^"']+)["']\)/,
    /location\.assign\(["']([^"']+)["']\)/,
  ];
  for (const pattern of jsRedirectPatterns) {
    const match = body.match(pattern);
    if (match) {
      const coords = extractCoordsFromString(match[1]);
      if (coords)
        return {
          lat: coords.lat,
          lng: coords.lng,
          placeName: extractPlaceName(match[1]) || extractPlaceName(body),
        };
    }
  }

  // 6. Scan full body for embedded Google Maps URLs
  const mapsUrlPattern =
    /https:\/\/(?:www\.|maps\.)?google\.com\/maps[^\s"'<>\\)]+/g;
  const urlMatches = body.match(mapsUrlPattern) || [];
  for (const u of urlMatches) {
    const coords = extractCoordsFromString(u);
    if (coords)
      return {
        lat: coords.lat,
        lng: coords.lng,
        placeName: extractPlaceName(u) || extractPlaceName(body),
      };
  }

  // 7. Direct coordinate scan in body
  const coords = extractCoordsFromString(body);
  if (coords)
    return {
      lat: coords.lat,
      lng: coords.lng,
      placeName: extractPlaceName(body),
    };

  return null;
}

/** Resolve a short link by racing 4 proxy strategies in parallel */
async function resolveShortLink(shortUrl: string): Promise<ParsedMapLocation> {
  const TIMEOUT = 12000;

  // Strategy 1: unshorten.me — purpose-built URL unshortener, returns final URL directly
  const unshortenMe = fetch(
    `https://unshorten.me/api/v1/unshorten?url=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`unshorten.me HTTP ${res.status}`);
    const json = (await res.json()) as {
      resolved_url?: string;
      requested_url?: string;
    };
    const resolvedUrl = json.resolved_url || json.requested_url || "";
    if (!resolvedUrl) throw new Error("unshorten.me: no URL in response");
    const coords = extractCoordsFromString(resolvedUrl);
    if (!coords) throw new Error("unshorten.me: no coords in resolved URL");
    return {
      latitude: coords.lat,
      longitude: coords.lng,
      placeName: extractPlaceName(resolvedUrl),
      isShortLink: false,
      error: null,
    } as ParsedMapLocation;
  });

  // Strategy 2: allorigins.win — fetches HTML and follows redirects, returns final URL
  const allOrigins = fetch(
    `https://api.allorigins.win/get?url=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`allorigins HTTP ${res.status}`);
    const json = (await res.json()) as {
      contents: string;
      status: { url: string };
    };
    const finalUrl = json?.status?.url ?? "";
    const body = json?.contents ?? "";
    const found = extractCoordsFromHtml(body, finalUrl);
    if (!found) throw new Error("allorigins: no coordinates found");
    return {
      latitude: found.lat,
      longitude: found.lng,
      placeName: found.placeName,
      isShortLink: false,
      error: null,
    } as ParsedMapLocation;
  });

  // Strategy 3: corsproxy.io — raw HTML proxy
  const corsProxy = fetch(
    `https://corsproxy.io/?${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`corsproxy HTTP ${res.status}`);
    const body = await res.text();
    const canonicalMatch =
      body.match(
        /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      ) ||
      body.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    const finalUrl = canonicalMatch
      ? decodeURIComponent(canonicalMatch[1])
      : "";
    const found = extractCoordsFromHtml(body, finalUrl);
    if (!found) throw new Error("corsproxy: no coordinates found");
    return {
      latitude: found.lat,
      longitude: found.lng,
      placeName: found.placeName,
      isShortLink: false,
      error: null,
    } as ParsedMapLocation;
  });

  // Strategy 4: codetabs proxy
  const codetabs = fetch(
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`codetabs HTTP ${res.status}`);
    const body = await res.text();
    const found = extractCoordsFromHtml(body, "");
    if (!found) throw new Error("codetabs: no coordinates found");
    return {
      latitude: found.lat,
      longitude: found.lng,
      placeName: found.placeName,
      isShortLink: false,
      error: null,
    } as ParsedMapLocation;
  });

  try {
    // Race all strategies — first one to succeed wins
    const result = await Promise.any([
      unshortenMe,
      allOrigins,
      corsProxy,
      codetabs,
    ]);
    return result;
  } catch {
    return {
      latitude: null,
      longitude: null,
      placeName: null,
      isShortLink: true,
      error:
        "Could not read this link automatically. Try opening the link in your browser, then copy the full URL from the address bar. Or use the 'My Location' button when you're standing at the store.",
    };
  }
}

/**
 * Parse any Google Maps URL or coordinate string.
 * Returns coordinates immediately for full URLs (no network call).
 * For short links (maps.app.goo.gl / goo.gl), races 4 proxies in parallel.
 */
export async function parseGoogleMapsUrl(
  input: string,
): Promise<ParsedMapLocation> {
  const trimmed = input.trim();
  if (!trimmed) return empty();

  // Plain coordinates: "40.7128,-74.0060"
  if (isPlainCoords(trimmed)) {
    const parts = trimmed.split(",");
    return {
      ...empty(),
      latitude: Number.parseFloat(parts[0].trim()),
      longitude: Number.parseFloat(parts[1].trim()),
    };
  }

  // Detect short links
  const isShort =
    /maps\.app\.goo\.gl/.test(trimmed) ||
    /goo\.gl\/maps/.test(trimmed) ||
    /^https?:\/\/goo\.gl\//.test(trimmed);

  if (isShort) {
    // Try to extract coords directly from the short URL first (rare but possible)
    const direct = extractCoordsFromString(trimmed);
    if (direct) {
      return {
        ...empty(),
        latitude: direct.lat,
        longitude: direct.lng,
        placeName: extractPlaceName(trimmed),
      };
    }
    return resolveShortLink(trimmed);
  }

  // Full URL — parse synchronously, no network needed
  return parseFullUrl(trimmed);
}
