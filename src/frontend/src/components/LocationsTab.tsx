import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Link,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useAddStore,
  useDeleteStore,
  useGetAllStores,
} from "../hooks/useQueries";
import type { Store } from "../hooks/useQueries";
import type { ParsedMapLocation } from "../utils/parseGoogleMapsUrl";
import { parseGoogleMapsUrl } from "../utils/parseGoogleMapsUrl";
import { StoreSkeleton } from "./ItemSkeleton";

interface StoreCardProps {
  store: Store;
  index: number;
}

function StoreCard({ store, index }: StoreCardProps) {
  const deleteStore = useDeleteStore();

  const handleDelete = async () => {
    try {
      await deleteStore.mutateAsync(store.id);
      toast.success(`"${store.name}" removed`);
    } catch {
      toast.error("Failed to delete store");
    }
  };

  return (
    <div
      data-ocid={`store.item.${index}`}
      className="p-4 rounded-xl bg-card border border-border shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <MapPin className="h-4 w-4 text-primary" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-black text-sm text-foreground truncate">
              {store.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
              {store.address}
            </p>
            <p className="text-[11px] text-muted-foreground/60 font-mono mt-1">
              {store.latitude.toFixed(6)}, {store.longitude.toFixed(6)}
            </p>
          </div>
        </div>
        <button
          type="button"
          data-ocid={`store.delete_button.${index}`}
          onClick={handleDelete}
          disabled={deleteStore.isPending}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Delete ${store.name}`}
        >
          {deleteStore.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

type LocationMode = "link" | "gps";

function AddStoreDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [locationMode, setLocationMode] = useState<LocationMode>("link");
  const [gpsCoords, setGpsCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMapLocation | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to `name` so we can read its latest value inside the effect
  // without listing it as a dependency (it would retrigger parsing on every keystroke).
  const nameRef = useRef(name);
  nameRef.current = name;
  const addStore = useAddStore();

  // Async parse whenever mapsUrl changes
  useEffect(() => {
    if (!mapsUrl.trim()) {
      setParsed(null);
      setIsResolving(false);
      return;
    }

    // Debounce so we don't fire on every keystroke
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsResolving(true);
      try {
        const result = await parseGoogleMapsUrl(mapsUrl);
        setParsed(result);
        // Auto-fill name from place name if the name field is currently empty
        if (result.placeName && !nameRef.current.trim()) {
          setName(result.placeName);
        }
      } finally {
        setIsResolving(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mapsUrl]);

  const handleGetLocation = () => {
    setGpsError(null);
    setGpsCoords(null);
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            "Location access denied. Please allow location in your browser settings.",
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError(
            "Location unavailable. Try again or use a Google Maps link.",
          );
        } else {
          setGpsError("Couldn't get your location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const activeLat =
    locationMode === "link"
      ? (parsed?.latitude ?? null)
      : (gpsCoords?.lat ?? null);
  const activeLng =
    locationMode === "link"
      ? (parsed?.longitude ?? null)
      : (gpsCoords?.lng ?? null);

  const canSubmit =
    name.trim() &&
    activeLat !== null &&
    activeLng !== null &&
    !isResolving &&
    (locationMode === "link"
      ? parsed && !parsed.error && !parsed.isShortLink
      : true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || activeLat === null || activeLng === null) return;

    const addressLabel =
      locationMode === "link"
        ? mapsUrl.trim() || name.trim()
        : `${activeLat.toFixed(6)}, ${activeLng.toFixed(6)}`;

    try {
      await addStore.mutateAsync({
        name: name.trim(),
        address: addressLabel,
        latitude: activeLat,
        longitude: activeLng,
      });
      toast.success(`"${name}" added to locations`);
      setName("");
      setMapsUrl("");
      setParsed(null);
      setGpsCoords(null);
      setGpsError(null);
      setLocationMode("link");
      setOpen(false);
    } catch {
      toast.error("Failed to add store");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-ocid="store.add_button"
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-yellow hover:shadow-yellow z-30 transition-transform hover:scale-105 active:scale-95"
          aria-label="Add new store"
          style={{ animation: "fab-pulse 2s ease-in-out infinite" }}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-auto rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-black">
            Add Location
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Mode switcher */}
          <div className="flex gap-1.5 p-1 bg-muted rounded-xl">
            <button
              type="button"
              data-ocid="store.paste_link.tab"
              onClick={() => setLocationMode("link")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150 ${
                locationMode === "link"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link className="h-3.5 w-3.5 shrink-0" />
              Paste Link
            </button>
            <button
              type="button"
              data-ocid="store.use_location.tab"
              onClick={() => setLocationMode("gps")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150 ${
                locationMode === "gps"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LocateFixed className="h-3.5 w-3.5 shrink-0" />
              My Location
            </button>
          </div>

          {/* Location input area */}
          <div className="space-y-1.5">
            {locationMode === "link" ? (
              <>
                <Label className="text-sm font-semibold">Google Maps URL</Label>
                <Input
                  data-ocid="store.maps_url.input"
                  placeholder="Paste any Google Maps link or coordinates…"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="bg-background font-mono text-xs"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {/* Resolved preview */}
                {mapsUrl.trim() && (
                  <div
                    className={`text-xs px-3 py-2 rounded-lg font-medium ${
                      isResolving
                        ? "bg-muted text-muted-foreground"
                        : parsed?.error || parsed?.isShortLink
                          ? "bg-destructive/10 text-destructive"
                          : parsed !== null && parsed.latitude !== null
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isResolving ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        Resolving link…
                      </span>
                    ) : parsed?.error ? (
                      <span>{parsed.error}</span>
                    ) : parsed !== null && parsed.latitude !== null ? (
                      <span className="flex items-center gap-1.5">
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                        {parsed.latitude.toFixed(6)},{" "}
                        {parsed.longitude!.toFixed(6)}
                      </span>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <>
                <Label className="text-sm font-semibold">
                  Use current location
                </Label>
                <button
                  type="button"
                  data-ocid="store.use_location_button"
                  onClick={handleGetLocation}
                  disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-border bg-background hover:bg-muted text-sm font-semibold text-foreground transition-colors disabled:opacity-60"
                >
                  {gpsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Getting location…
                    </>
                  ) : (
                    <>
                      <LocateFixed className="h-4 w-4 text-primary" />
                      {gpsCoords ? "Refresh Location" : "Get My Location"}
                    </>
                  )}
                </button>
                {gpsCoords && !gpsError && (
                  <div className="text-xs px-3 py-2 rounded-lg font-medium bg-primary/10 text-primary">
                    <span className="flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                      {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                    </span>
                  </div>
                )}
                {gpsError && (
                  <div className="text-xs px-3 py-2 rounded-lg font-medium bg-destructive/10 text-destructive">
                    {gpsError}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-name" className="text-sm font-semibold">
              Store name
            </Label>
            <Input
              id="store-name"
              data-ocid="store.name.input"
              placeholder="e.g. Whole Foods Market"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className="bg-background"
            />
          </div>
          <Button
            type="submit"
            data-ocid="store.submit_button"
            disabled={!canSubmit || addStore.isPending}
            className="w-full bg-primary text-primary-foreground font-bold rounded-xl h-11 disabled:opacity-40"
          >
            {addStore.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Location"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationsTab() {
  const { data: stores = [], isLoading } = useGetAllStores();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {isLoading ? (
          ["a", "b", "c"].map((k) => <StoreSkeleton key={k} />)
        ) : stores.length === 0 ? (
          <div
            data-ocid="store.empty_state"
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-display font-black text-base text-foreground">
              No locations saved
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[220px]">
              Tap the + button to add a store location via Google Maps
            </p>
          </div>
        ) : (
          stores.map((store, index) => (
            <StoreCard key={String(store.id)} store={store} index={index + 1} />
          ))
        )}
      </div>

      <AddStoreDialog />
    </div>
  );
}
