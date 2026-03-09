export interface ParsedMapLocation {
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  isShortLink: boolean;
  error: string | null;
}

/** Detect if a string is a plain coordinate pair like "40.7128,-74.0060" */
function isPlainCoords(input: string): boolean {
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(input.trim());
}

/** Parse a fully-expanded Google Maps URL synchronously */
function parseFullUrl(url: string): ParsedMapLocation {
  const result: ParsedMapLocation = {
    latitude: null,
    longitude: null,
    placeName: null,
    isShortLink: false,
    error: null,
  };

  try {
    const parsed = new URL(url);

    // Format: https://www.google.com/maps/place/NAME/@lat,lng,zoom
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      result.latitude = Number.parseFloat(atMatch[1]);
      result.longitude = Number.parseFloat(atMatch[2]);
      const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
      if (placeMatch) {
        result.placeName = decodeURIComponent(
          placeMatch[1].replace(/\+/g, " "),
        );
      }
      return result;
    }

    // Format: /maps/place/NAME/data=...!3d{lat}!4d{lng}
    const d3dMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (d3dMatch) {
      result.latitude = Number.parseFloat(d3dMatch[1]);
      result.longitude = Number.parseFloat(d3dMatch[2]);
      const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
      if (placeMatch) {
        result.placeName = decodeURIComponent(
          placeMatch[1].replace(/\+/g, " "),
        );
      }
      return result;
    }

    // Reversed order: !4d{lng}!3d{lat}
    const d4dFirst = url.match(/!4d(-?\d+\.\d+).*!3d(-?\d+\.\d+)/);
    if (d4dFirst) {
      result.longitude = Number.parseFloat(d4dFirst[1]);
      result.latitude = Number.parseFloat(d4dFirst[2]);
      const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
      if (placeMatch) {
        result.placeName = decodeURIComponent(
          placeMatch[1].replace(/\+/g, " "),
        );
      }
      return result;
    }

    // Format: https://www.google.com/maps/search/?api=1&query=lat,lng or query=PlaceName
    if (
      parsed.pathname.includes("/maps/search") ||
      parsed.pathname.includes("/maps/dir")
    ) {
      const queryParam =
        parsed.searchParams.get("query") ||
        parsed.searchParams.get("destination");
      if (queryParam) {
        const latLngMatch = queryParam.match(
          /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/,
        );
        if (latLngMatch) {
          result.latitude = Number.parseFloat(latLngMatch[1]);
          result.longitude = Number.parseFloat(latLngMatch[2]);
          return result;
        }
        result.placeName = queryParam.replace(/\+/g, " ");
        result.error =
          "This URL contains a place name but no exact coordinates. Please open the place in Google Maps, tap on it, and copy the full URL.";
        return result;
      }
    }

    // Format: ?q=lat,lng or ?q=place+name
    const qParam = parsed.searchParams.get("q");
    if (qParam) {
      const latLngMatch = qParam.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
      if (latLngMatch) {
        result.latitude = Number.parseFloat(latLngMatch[1]);
        result.longitude = Number.parseFloat(latLngMatch[2]);
      } else {
        result.placeName = qParam.replace(/\+/g, " ");
        result.error =
          "This URL contains a place name but no exact coordinates. Please search for the place in Google Maps, click on it, and copy the full URL with coordinates (it will contain @lat,lng).";
      }
      return result;
    }

    // Format: ll param
    const llParam = parsed.searchParams.get("ll");
    if (llParam) {
      const parts = llParam.split(",");
      if (parts.length >= 2) {
        result.latitude = Number.parseFloat(parts[0]);
        result.longitude = Number.parseFloat(parts[1]);
        return result;
      }
    }

    // Format: center param
    const centerParam = parsed.searchParams.get("center");
    if (centerParam) {
      const parts = centerParam.split(",");
      if (parts.length >= 2) {
        result.latitude = Number.parseFloat(parts[0]);
        result.longitude = Number.parseFloat(parts[1]);
        return result;
      }
    }

    // CID links — can't resolve to coords client-side
    const cidParam = parsed.searchParams.get("cid");
    const hasCidInPath = url.includes("1s0x") || url.includes("%3A0x");
    if (cidParam || hasCidInPath) {
      result.error =
        "This shared link doesn't contain coordinates. Please open the place in Google Maps, tap 'Share', then copy the URL that contains coordinates (look for @lat,lng or !3d!4d in the URL).";
      return result;
    }

    result.error =
      "Couldn't extract coordinates. In Google Maps, search for the store, tap on it to open its page, then copy the URL from your browser's address bar.";
    return result;
  } catch {
    result.error = "Invalid URL. Please paste a valid Google Maps link.";
    return result;
  }
}

/** Try to extract coords from any text (HTML body or URL string) */
function extractCoordsFromText(
  text: string,
): { lat: number; lng: number } | null {
  // @lat,lng pattern
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      lat: Number.parseFloat(atMatch[1]),
      lng: Number.parseFloat(atMatch[2]),
    };
  }
  // !3d{lat}!4d{lng} pattern
  const d3dMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d3dMatch) {
    return {
      lat: Number.parseFloat(d3dMatch[1]),
      lng: Number.parseFloat(d3dMatch[2]),
    };
  }
  return null;
}

/** Resolve a short link via allorigins proxy and extract coords from the response */
async function resolveShortLink(shortUrl: string): Promise<ParsedMapLocation> {
  const empty: ParsedMapLocation = {
    latitude: null,
    longitude: null,
    placeName: null,
    isShortLink: true,
    error: null,
  };

  // allorigins returns { contents: "<html>...", status: { url: "<final-url>" } }
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(shortUrl)}`;

  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as {
      contents: string;
      status: { url: string };
    };

    // 1. Try to parse coords from the final redirect URL reported by the proxy
    const finalUrl: string = json?.status?.url ?? "";
    if (finalUrl && !finalUrl.includes("allorigins")) {
      const fromUrl = parseFullUrl(finalUrl);
      if (fromUrl.latitude !== null) return { ...fromUrl, isShortLink: false };

      // Coords may not be in URL — fall through to HTML scan
    }

    const html: string = json?.contents ?? "";

    // 2. Scan HTML for coordinate patterns
    const fromHtml = extractCoordsFromText(html);
    if (fromHtml) {
      // Try to get place name from <title>
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
      const placeName = titleMatch
        ? titleMatch[1].replace(/ - Google Maps$/, "").trim()
        : null;
      return {
        ...empty,
        isShortLink: false,
        latitude: fromHtml.lat,
        longitude: fromHtml.lng,
        placeName,
      };
    }

    // 3. Look for a redirect URL embedded in the HTML (meta refresh / canonical)
    const redirectPatterns = [
      /content=["'][^"']*url=([^"'&]+)/i,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      /window\.location\s*=\s*["']([^"']+)["']/,
    ];
    for (const pattern of redirectPatterns) {
      const m = html.match(pattern);
      if (m?.[1]) {
        const fromRedirect = parseFullUrl(decodeURIComponent(m[1]));
        if (fromRedirect.latitude !== null)
          return { ...fromRedirect, isShortLink: false };
      }
    }

    return {
      ...empty,
      error:
        "Couldn't extract coordinates from this link. Try opening it in Google Maps, tapping the share button, and copying the link that appears.",
    };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ...empty,
      error: isTimeout
        ? "Timed out resolving the link. Check your internet connection and try again."
        : "Couldn't resolve this short link. Try opening it in Google Maps, tapping the share button, and copying the link that appears.",
    };
  }
}

/**
 * Parse a Google Maps URL or coordinate string.
 * Handles short links (goo.gl / maps.app.goo.gl) by resolving them via a proxy.
 */
export async function parseGoogleMapsUrl(
  input: string,
): Promise<ParsedMapLocation> {
  const trimmed = input.trim();

  const empty: ParsedMapLocation = {
    latitude: null,
    longitude: null,
    placeName: null,
    isShortLink: false,
    error: null,
  };

  if (!trimmed) return empty;

  // Plain coordinates: "40.7128,-74.0060" or "40.7128, -74.0060"
  if (isPlainCoords(trimmed)) {
    const parts = trimmed.split(",");
    return {
      ...empty,
      latitude: Number.parseFloat(parts[0].trim()),
      longitude: Number.parseFloat(parts[1].trim()),
    };
  }

  // Short links — resolve via proxy
  const isShortLink =
    trimmed.includes("maps.app.goo.gl") ||
    trimmed.includes("goo.gl/maps") ||
    /^https?:\/\/goo\.gl\//.test(trimmed);

  if (isShortLink) {
    return resolveShortLink(trimmed);
  }

  // Full URL — parse synchronously
  return parseFullUrl(trimmed);
}
