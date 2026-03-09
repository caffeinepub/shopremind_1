export interface ParsedMapLocation {
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  isShortLink: boolean;
  error: string | null;
}

export function parseGoogleMapsUrl(url: string): ParsedMapLocation {
  const result: ParsedMapLocation = {
    latitude: null,
    longitude: null,
    placeName: null,
    isShortLink: false,
    error: null,
  };

  if (!url.trim()) return result;

  // Short links - can't resolve client-side
  if (url.includes("goo.gl/maps") || url.includes("maps.app.goo.gl")) {
    result.isShortLink = true;
    result.error =
      "Short links can't be resolved client-side. Please open the link in your browser and copy the full URL from the address bar.";
    return result;
  }

  try {
    const parsed = new URL(url);

    // Format: https://www.google.com/maps/place/NAME/@lat,lng,zoom
    // e.g. https://www.google.com/maps/place/Central+Park/@40.7825547,-73.9654345,15z
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      result.latitude = Number.parseFloat(atMatch[1]);
      result.longitude = Number.parseFloat(atMatch[2]);

      // Try to extract place name from path
      const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
      if (placeMatch) {
        result.placeName = decodeURIComponent(
          placeMatch[1].replace(/\+/g, " "),
        );
      }
      return result;
    }

    // Format: /maps/place/NAME/data=...!3d{lat}!4d{lng}
    // Used by Google Maps "Share" button — the lat/lng are encoded as !3d and !4d params
    const d3dMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (d3dMatch) {
      result.latitude = Number.parseFloat(d3dMatch[1]);
      result.longitude = Number.parseFloat(d3dMatch[2]);
      // Try to extract place name from path
      const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
      if (placeMatch) {
        result.placeName = decodeURIComponent(
          placeMatch[1].replace(/\+/g, " "),
        );
      }
      return result;
    }

    // Also handle reversed order: !4d{lng}!3d{lat} (less common but possible)
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

    // Format: https://www.google.com/maps?q=lat,lng or ?q=place+name
    // Format: https://maps.google.com/?q=lat,lng
    const qParam = parsed.searchParams.get("q");
    if (qParam) {
      const latLngMatch = qParam.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
      if (latLngMatch) {
        result.latitude = Number.parseFloat(latLngMatch[1]);
        result.longitude = Number.parseFloat(latLngMatch[2]);
      } else {
        // It's a place name query, can't get exact coords
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

    // CID links (e.g. ?cid=...) — can't resolve to coords client-side
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
