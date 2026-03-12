export interface ParsedMapLocation {
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  isShortLink: boolean;
  error: string | null;
  needsManualEntry?: boolean;
}

const empty = (): ParsedMapLocation => ({
  latitude: null,
  longitude: null,
  placeName: null,
  isShortLink: false,
  error: null,
  needsManualEntry: false,
});

function isPlainCoords(input: string): boolean {
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(input.trim());
}

function extractCoordsFromString(
  text: string,
): { lat: number; lng: number } | null {
  const d3dMatch = text.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (d3dMatch) {
    const lat = Number.parseFloat(d3dMatch[1]);
    const lng = Number.parseFloat(d3dMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const d8mMatch = text.match(/!8m2!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (d8mMatch) {
    const lat = Number.parseFloat(d8mMatch[1]);
    const lng = Number.parseFloat(d8mMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const d4dFirst = text.match(/!4d(-?\d+\.?\d*).*?!3d(-?\d+\.?\d*)/);
  if (d4dFirst) {
    const lng = Number.parseFloat(d4dFirst[1]);
    const lat = Number.parseFloat(d4dFirst[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const atMatch = text.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = Number.parseFloat(atMatch[1]);
    const lng = Number.parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const pathAtMatch = text.match(
    /\/maps\/(?:[^/]+\/)*@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  );
  if (pathAtMatch) {
    const lat = Number.parseFloat(pathAtMatch[1]);
    const lng = Number.parseFloat(pathAtMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const destMatch = text.match(
    /[?&](?:destination|origin|query|q)=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  );
  if (destMatch) {
    const lat = Number.parseFloat(destMatch[1]);
    const lng = Number.parseFloat(destMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const llMatch = text.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) {
    const lat = Number.parseFloat(llMatch[1]);
    const lng = Number.parseFloat(llMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const centerMatch = text.match(/[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (centerMatch) {
    const lat = Number.parseFloat(centerMatch[1]);
    const lng = Number.parseFloat(centerMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const sllMatch = text.match(/[?&]sll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (sllMatch) {
    const lat = Number.parseFloat(sllMatch[1]);
    const lng = Number.parseFloat(sllMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const cbllMatch = text.match(/[?&]cbll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (cbllMatch) {
    const lat = Number.parseFloat(cbllMatch[1]);
    const lng = Number.parseFloat(cbllMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const pathCoordsMatch = text.match(
    /\/(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})/,
  );
  if (pathCoordsMatch) {
    const lat = Number.parseFloat(pathCoordsMatch[1]);
    const lng = Number.parseFloat(pathCoordsMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function extractPlaceName(text: string): string | null {
  const placeMatch = text.match(/\/maps\/(?:place|search)\/([^/@?#]+)/);
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
  const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    return titleMatch[1].replace(/ - Google Maps$/, "").trim();
  }
  return null;
}

function extractCoordsFromHtml(
  body: string,
  finalUrl: string,
): { lat: number; lng: number; placeName: string | null } | null {
  // 1. From the resolved final URL
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

  // 4. JSON-LD structured data with GeoCoordinates
  const jsonLdMatches = [
    ...body.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const geo = item?.geo || item?.location?.geo;
        if (geo) {
          const lat = Number.parseFloat(geo.latitude);
          const lng = Number.parseFloat(geo.longitude);
          if (isValidLatLng(lat, lng)) {
            return { lat, lng, placeName: item.name || null };
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 5. Google embeds coordinates in JS arrays like [null,null,LAT,LNG]
  const jsCoordPattern =
    /[\[,]\s*(-?(?:90|[1-8]?\d)\.\d{4,})\s*,\s*(-?(?:180|1[0-7]\d|[1-9]?\d)\.\d{4,})\s*[,\]]/g;
  for (const m of [...body.matchAll(jsCoordPattern)]) {
    const lat = Number.parseFloat(m[1]);
    const lng = Number.parseFloat(m[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, placeName: extractPlaceName(body) };
    }
  }

  // 6. JSON key patterns: "lat":40.7128,"lng":-74.006
  const jsonLatLng = body.match(
    /["'](?:lat(?:itude)?)["']\s*:\s*(-?\d+\.\d+)[\s\S]{0,30}?["'](?:lng|lon(?:g(?:itude)?)?)["']\s*:\s*(-?\d+\.\d+)/i,
  );
  if (jsonLatLng) {
    const lat = Number.parseFloat(jsonLatLng[1]);
    const lng = Number.parseFloat(jsonLatLng[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, placeName: extractPlaceName(body) };
    }
  }

  // 7. Meta refresh redirect
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

  // 8. JavaScript redirect patterns
  for (const pattern of [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/,
    /location\.replace\(["']([^"']+)["']\)/,
    /location\.assign\(["']([^"']+)["']\)/,
  ]) {
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

  // 9. Scan body for embedded Google Maps URLs
  for (const u of body.match(
    /https:\/\/(?:www\.|maps\.)?google\.com\/maps[^\s"'<>\\)]+/g,
  ) || []) {
    const coords = extractCoordsFromString(u);
    if (coords)
      return {
        lat: coords.lat,
        lng: coords.lng,
        placeName: extractPlaceName(u) || extractPlaceName(body),
      };
  }

  // 10. Direct coordinate scan in body
  const coords = extractCoordsFromString(body);
  if (coords)
    return {
      lat: coords.lat,
      lng: coords.lng,
      placeName: extractPlaceName(body),
    };

  return null;
}

function parseFullUrl(url: string): ParsedMapLocation {
  const result = empty();
  try {
    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      /* ignore */
    }

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
    const placeIdParam = parsed.searchParams.get("place_id");

    if (cidParam || placeIdParam) {
      result.error =
        "This link doesn't contain coordinates. In Google Maps, tap on the store, then tap 'Share' and copy the link.";
      return result;
    }

    if (queryParam) {
      const coordMatch = queryParam.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const lat = Number.parseFloat(coordMatch[1]);
        const lng = Number.parseFloat(coordMatch[2]);
        if (isValidLatLng(lat, lng)) {
          result.latitude = lat;
          result.longitude = lng;
          return result;
        }
      }
      result.placeName = queryParam.replace(/\+/g, " ");
      result.error =
        "This link has a place name but no coordinates. Tap the store pin in Google Maps, then tap Share to get the correct link.";
      return result;
    }

    result.error =
      "Couldn't read coordinates from this link. Try: tap the store in Google Maps → Share → copy the link.";
    return result;
  } catch {
    result.error = "Invalid URL. Please paste a valid Google Maps link.";
    return result;
  }
}

async function resolveShortLink(shortUrl: string): Promise<ParsedMapLocation> {
  const TIMEOUT = 15000;

  const makeResult = (
    lat: number,
    lng: number,
    placeName: string | null,
  ): ParsedMapLocation => ({
    latitude: lat,
    longitude: lng,
    placeName,
    isShortLink: false,
    error: null,
    needsManualEntry: false,
  });

  const unshortenMe = fetch(
    `https://unshorten.me/api/v1/unshorten?url=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`unshorten.me ${res.status}`);
    const json = (await res.json()) as {
      resolved_url?: string;
      requested_url?: string;
    };
    const resolvedUrl = json.resolved_url || json.requested_url || "";
    if (!resolvedUrl) throw new Error("no URL");
    const coords = extractCoordsFromString(resolvedUrl);
    if (!coords) throw new Error("no coords");
    return makeResult(coords.lat, coords.lng, extractPlaceName(resolvedUrl));
  });

  const allOrigins = fetch(
    `https://api.allorigins.win/get?url=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`allorigins ${res.status}`);
    const json = (await res.json()) as {
      contents: string;
      status: { url: string };
    };
    const found = extractCoordsFromHtml(
      json?.contents ?? "",
      json?.status?.url ?? "",
    );
    if (!found) throw new Error("no coords");
    return makeResult(found.lat, found.lng, found.placeName);
  });

  const allOriginsRaw = fetch(
    `https://api.allorigins.win/raw?url=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    const body = await res.text();
    const found = extractCoordsFromHtml(body, res.url || "");
    if (!found) throw new Error("no coords");
    return makeResult(found.lat, found.lng, found.placeName);
  });

  const corsProxy = fetch(
    `https://corsproxy.io/?${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    const body = await res.text();
    const found = extractCoordsFromHtml(body, res.url || "");
    if (!found) throw new Error("no coords");
    return makeResult(found.lat, found.lng, found.placeName);
  });

  const codetabs = fetch(
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`codetabs ${res.status}`);
    const body = await res.text();
    const found = extractCoordsFromHtml(body, "");
    if (!found) throw new Error("no coords");
    return makeResult(found.lat, found.lng, found.placeName);
  });

  const thingProxy = fetch(
    `https://thingproxy.freeboard.io/fetch/${shortUrl}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`thingproxy ${res.status}`);
    const body = await res.text();
    const found = extractCoordsFromHtml(body, "");
    if (!found) throw new Error("no coords");
    return makeResult(found.lat, found.lng, found.placeName);
  });

  const workersProxy = fetch(
    `https://corsproxy.org/?url=${encodeURIComponent(shortUrl)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  ).then(async (res) => {
    const body = await res.text();
    const found = extractCoordsFromHtml(body, res.url || "");
    if (!found) throw new Error("no coords");
    return makeResult(found.lat, found.lng, found.placeName);
  });

  try {
    return await Promise.any([
      unshortenMe,
      allOrigins,
      allOriginsRaw,
      corsProxy,
      codetabs,
      thingProxy,
      workersProxy,
    ]);
  } catch {
    return {
      latitude: null,
      longitude: null,
      placeName: null,
      isShortLink: true,
      needsManualEntry: true,
      error:
        "Could not auto-read this link. Please enter the coordinates manually below (you can find them by opening the link in your browser), or use 'My Location' while standing at the store.",
    };
  }
}

function isShortLink(url: string): boolean {
  return (
    /maps\.app\.goo\.gl/.test(url) ||
    /goo\.gl\/maps/.test(url) ||
    /^https?:\/\/goo\.gl\//.test(url) ||
    /^https?:\/\/g\.co\//.test(url) ||
    /^https?:\/\/maps\.google\.com\/maps\?/.test(url)
  );
}

export async function parseGoogleMapsUrl(
  input: string,
): Promise<ParsedMapLocation> {
  const trimmed = input.trim();
  if (!trimmed) return empty();

  if (isPlainCoords(trimmed)) {
    const parts = trimmed.split(",");
    const lat = Number.parseFloat(parts[0].trim());
    const lng = Number.parseFloat(parts[1].trim());
    if (isValidLatLng(lat, lng)) {
      return { ...empty(), latitude: lat, longitude: lng };
    }
  }

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    /* ignore */
  }
  const direct =
    extractCoordsFromString(trimmed) || extractCoordsFromString(decoded);
  if (direct) {
    return {
      ...empty(),
      latitude: direct.lat,
      longitude: direct.lng,
      placeName: extractPlaceName(decoded) || extractPlaceName(trimmed),
    };
  }

  if (isShortLink(trimmed)) {
    return resolveShortLink(trimmed);
  }

  return parseFullUrl(trimmed);
}
