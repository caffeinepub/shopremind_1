import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  LogIn,
  Navigation,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Variant_pending_bought } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAddShoppingItem,
  useAddStore,
  useDeleteShoppingItem,
  useGetAllShoppingItems,
  useGetAllStores,
  useUpdateItemStatus,
} from "../hooks/useQueries";
import type { ShoppingItem, Store } from "../hooks/useQueries";
import type { ParsedMapLocation } from "../utils/parseGoogleMapsUrl";
import { parseGoogleMapsUrl } from "../utils/parseGoogleMapsUrl";
import { ItemSkeleton } from "./ItemSkeleton";

type FilterType = "all" | "pending" | "bought";
type LocationMode = "link" | "gps";

const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "bought", label: "Bought" },
];

interface ItemCardProps {
  item: ShoppingItem;
  store: Store | undefined;
  index: number;
}

function ItemCard({ item, store, index }: ItemCardProps) {
  const updateStatus = useUpdateItemStatus();
  const deleteItem = useDeleteShoppingItem();
  const isBought = item.status === Variant_pending_bought.bought;

  const handleToggle = async () => {
    const newStatus = isBought
      ? Variant_pending_bought.pending
      : Variant_pending_bought.bought;
    try {
      await updateStatus.mutateAsync({ itemId: item.id, status: newStatus });
    } catch {
      toast.error("Failed to update item status");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success("Item removed");
    } catch {
      toast.error("Failed to delete item");
    }
  };

  return (
    <div
      data-ocid={`item.item.${index}`}
      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-shadow"
    >
      <Checkbox
        data-ocid={`item.checkbox.${index}`}
        id={`item-${String(item.id)}`}
        checked={isBought}
        onCheckedChange={handleToggle}
        disabled={updateStatus.isPending}
        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`font-display font-bold text-sm leading-tight truncate ${
            isBought ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {item.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-medium">
            ×{item.quantity}
          </span>
          {store && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground truncate">
                {store.name}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isBought && (
          <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary px-2 py-0.5 rounded-full">
            Pending
          </span>
        )}
        <button
          type="button"
          data-ocid={`item.delete_button.${index}`}
          onClick={handleDelete}
          disabled={deleteItem.isPending}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Delete ${item.name}`}
        >
          {deleteItem.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function AddItemDialog({ stores }: { stores: Store[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [storeName, setStoreName] = useState("");
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
  const storeNameRef = useRef(storeName);
  storeNameRef.current = storeName;
  const addItem = useAddShoppingItem();
  const addStore = useAddStore();
  const { identity, isLoggingIn } = useInternetIdentity();
  // Check actor readiness so we don't submit before the authenticated actor is ready.
  // This prevents the "please sign in" error when the actor is still initializing
  // immediately after login.
  const { isFetching: actorFetching } = useActor();
  const isSignedIn = !!identity;

  // Async parse whenever mapsUrl changes
  useEffect(() => {
    if (!mapsUrl.trim()) {
      setParsed(null);
      setIsResolving(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsResolving(true);
      try {
        const result = await parseGoogleMapsUrl(mapsUrl);
        setParsed(result);
        if (result.placeName && !storeNameRef.current.trim()) {
          setStoreName(result.placeName);
        }
      } finally {
        setIsResolving(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mapsUrl]);

  const coordsOk = parsed && parsed.latitude !== null && !parsed.error;

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

  // Require actor to be ready (!actorFetching) so we don't hit
  // the backend with an anonymous actor right after login.
  const canSubmit =
    isSignedIn &&
    !actorFetching &&
    name.trim() &&
    quantity.trim() &&
    storeName.trim() &&
    activeLat !== null &&
    activeLng !== null &&
    !isResolving &&
    (locationMode === "link" ? coordsOk : true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || activeLat === null || activeLng === null) return;

    const addressLabel =
      locationMode === "link"
        ? mapsUrl.trim()
        : `${activeLat.toFixed(6)}, ${activeLng.toFixed(6)}`;

    try {
      const existingStore = stores.find(
        (s) =>
          Math.abs(s.latitude - activeLat) < 0.0001 &&
          Math.abs(s.longitude - activeLng) < 0.0001,
      );

      let targetStoreId: bigint;
      if (existingStore) {
        targetStoreId = existingStore.id;
      } else {
        const newStoreId = await addStore.mutateAsync({
          name: storeName.trim(),
          address: addressLabel,
          latitude: activeLat,
          longitude: activeLng,
        });
        targetStoreId = newStoreId;
      }

      await addItem.mutateAsync({
        name: name.trim(),
        quantity: quantity.trim(),
        storeId: targetStoreId,
      });

      toast.success(`"${name}" added to your list`);
      setName("");
      setQuantity("");
      setStoreName("");
      setMapsUrl("");
      setParsed(null);
      setGpsCoords(null);
      setGpsError(null);
      setLocationMode("link");
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("Please sign in") ||
        msg.includes("not registered") ||
        msg.includes("Unauthorized") ||
        msg.includes("Not signed in") ||
        msg.includes("session") ||
        msg.includes("expired")
      ) {
        toast.error(
          "Session issue detected. Please sign out and sign in again.",
          { duration: 5000 },
        );
      } else if (msg.includes("Store does not exist")) {
        toast.error("Store could not be saved. Please try again.");
      } else {
        toast.error("Failed to add item. Please try again.");
      }
    }
  };

  const isBusy = addItem.isPending || addStore.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-ocid="item.add_button"
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-yellow hover:shadow-yellow z-30 transition-transform hover:scale-105 active:scale-95"
          aria-label="Add new item"
          style={{ animation: "fab-pulse 2s ease-in-out infinite" }}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-auto rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-black">
            Add Item
          </DialogTitle>
        </DialogHeader>

        {/* Sign-in banner */}
        {!isSignedIn && (
          <div
            data-ocid="item.auth.panel"
            className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/25 mt-2"
          >
            <LogIn className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                Sign in to save items to your list
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use the Sign In button in the top right corner.
              </p>
            </div>
            {isLoggingIn && (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
            )}
          </div>
        )}

        {/* Connecting indicator — shown when signed in but actor not ready yet */}
        {isSignedIn && actorFetching && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted mt-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">Connecting…</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="item-name" className="text-sm font-semibold">
              Item name
            </Label>
            <Input
              id="item-name"
              data-ocid="item.name.input"
              placeholder="e.g. Organic milk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className="bg-background"
              disabled={!isSignedIn}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-qty" className="text-sm font-semibold">
              Quantity
            </Label>
            <Input
              id="item-qty"
              data-ocid="item.quantity.input"
              placeholder="e.g. 2, 500g, 1 dozen"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoComplete="off"
              className="bg-background"
              disabled={!isSignedIn}
            />
          </div>

          {/* Store location section */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Store location</Label>

            {/* Mode switcher */}
            <div className="flex gap-1.5 p-1 bg-muted rounded-xl">
              <button
                type="button"
                data-ocid="store.paste_link.tab"
                onClick={() => setLocationMode("link")}
                disabled={!isSignedIn}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-50 ${
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
                disabled={!isSignedIn}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-50 ${
                  locationMode === "gps"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LocateFixed className="h-3.5 w-3.5 shrink-0" />
                My Location
              </button>
            </div>

            {locationMode === "link" ? (
              <>
                <Input
                  data-ocid="item.store_url.input"
                  placeholder="Paste any Google Maps link or coordinates…"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="bg-background font-mono text-xs"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={!isSignedIn}
                />
                {mapsUrl.trim() && (
                  <div
                    className={`text-xs px-3 py-2 rounded-lg font-medium ${
                      isResolving
                        ? "bg-muted text-muted-foreground"
                        : parsed?.error ||
                            (parsed !== null &&
                              parsed.latitude === null &&
                              !isResolving)
                          ? "bg-destructive/10 text-destructive"
                          : coordsOk
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
                    ) : coordsOk ? (
                      <span className="flex items-center gap-1.5">
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                        {parsed.latitude!.toFixed(6)},{" "}
                        {parsed.longitude!.toFixed(6)}
                      </span>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-ocid="store.use_location_button"
                  onClick={handleGetLocation}
                  disabled={!isSignedIn || gpsLoading}
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
            <Label htmlFor="item-store-name" className="text-sm font-semibold">
              Store name
            </Label>
            <Input
              id="item-store-name"
              data-ocid="item.store_name.input"
              placeholder="e.g. Whole Foods Market"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              autoComplete="off"
              className="bg-background"
              disabled={!isSignedIn}
            />
          </div>
          <Button
            type="submit"
            data-ocid="item.submit_button"
            disabled={!canSubmit || isBusy}
            className="w-full bg-primary text-primary-foreground font-bold rounded-xl h-11 disabled:opacity-40"
          >
            {isBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : actorFetching && isSignedIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              "Add to List"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MyListTab() {
  const [filter, setFilter] = useState<FilterType>("pending");
  const { data: items = [], isLoading: itemsLoading } =
    useGetAllShoppingItems();
  const { data: stores = [], isLoading: storesLoading } = useGetAllStores();

  const isLoading = itemsLoading || storesLoading;

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "pending")
      return item.status === Variant_pending_bought.pending;
    return item.status === Variant_pending_bought.bought;
  });

  const storeMap = new Map(stores.map((s) => [String(s.id), s]));

  return (
    <div className="flex flex-col h-full">
      {/* Filter Pills */}
      <div className="flex gap-2 px-4 pt-4 pb-3 shrink-0">
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            data-ocid={`list.${key}.tab`}
            onClick={() => setFilter(key)}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-all duration-150 ${
              filter === key
                ? "bg-primary text-primary-foreground shadow-yellow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {key !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                (
                {key === "pending"
                  ? items.filter(
                      (i) => i.status === Variant_pending_bought.pending,
                    ).length
                  : items.filter(
                      (i) => i.status === Variant_pending_bought.bought,
                    ).length}
                )
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading ? (
          ["a", "b", "c", "d"].map((k) => <ItemSkeleton key={k} />)
        ) : filteredItems.length === 0 ? (
          <div
            data-ocid="item.empty_state"
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-display font-black text-base text-foreground">
              {filter === "all"
                ? "Your list is empty"
                : filter === "pending"
                  ? "Nothing pending"
                  : "Nothing bought yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
              {filter === "all"
                ? "Tap the + button to add items"
                : filter === "pending"
                  ? "All items are bought!"
                  : "Check off items as you shop"}
            </p>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <ItemCard
              key={String(item.id)}
              item={item}
              store={storeMap.get(String(item.storeId))}
              index={index + 1}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <AddItemDialog stores={stores} />
    </div>
  );
}
