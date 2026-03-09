import { useCallback, useEffect, useRef } from "react";
import { Variant_pending_bought } from "../backend.d";
import type { ShoppingItem, Store } from "./useQueries";

const PROXIMITY_RADIUS_METERS = 500;
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface ProximityAlert {
  store: Store;
  pendingItems: ShoppingItem[];
}

interface UseProximityOptions {
  stores: Store[];
  items: ShoppingItem[];
  onAlert: (alert: ProximityAlert) => void;
}

export function useProximity({ stores, items, onAlert }: UseProximityOptions) {
  const watchIdRef = useRef<number | null>(null);
  const lastAlertRef = useRef<Map<string, number>>(new Map());
  const notificationPermissionRequestedRef = useRef(false);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  // Stable refs so the watcher callback always reads latest data
  // without causing the watcher to restart on every poll.
  const storesRef = useRef(stores);
  storesRef.current = stores;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const requestNotificationPermission = useCallback(async () => {
    if (notificationPermissionRequestedRef.current) return;
    notificationPermissionRequestedRef.current = true;
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const fireNotification = useCallback(
    (store: Store, pendingItems: ShoppingItem[]) => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const itemNames = pendingItems.map((i) => i.name).join(", ");
      new Notification(`ShopRemind: Near ${store.name}`, {
        body: `Pick up: ${itemNames}`,
        icon: "/favicon.ico",
      });
    },
    [],
  );

  // Stable callback — reads stores/items from refs, never changes identity.
  const checkProximity = useCallback(
    (position: GeolocationPosition) => {
      const { latitude: userLat, longitude: userLon } = position.coords;
      const now = Date.now();

      for (const store of storesRef.current) {
        const dist = haversineDistance(
          userLat,
          userLon,
          store.latitude,
          store.longitude,
        );

        if (dist <= PROXIMITY_RADIUS_METERS) {
          const storeKey = String(store.id);
          const lastAlert = lastAlertRef.current.get(storeKey) ?? 0;

          if (now - lastAlert < DEBOUNCE_MS) continue;

          const pendingItems = itemsRef.current.filter(
            (item) =>
              item.storeId === store.id &&
              item.status === Variant_pending_bought.pending,
          );

          if (pendingItems.length === 0) continue;

          lastAlertRef.current.set(storeKey, now);
          onAlertRef.current({ store, pendingItems });
          fireNotification(store, pendingItems);
        }
      }
    },
    [fireNotification],
  );

  // Register the watcher once — never restarts due to data refetches.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        requestNotificationPermission();
        checkProximity(pos);
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [checkProximity, requestNotificationPermission]);
}
