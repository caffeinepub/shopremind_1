import { MapPin, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProximityAlert } from "../hooks/useProximity";

interface ProximityBannerProps {
  alert: ProximityAlert | null;
  onDismiss: () => void;
}

export function ProximityBanner({ alert, onDismiss }: ProximityBannerProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAlertRef = useRef<ProximityAlert | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      currentAlertRef.current = null;
      onDismissRef.current();
    }, 280);
  }, []);

  useEffect(() => {
    if (alert && alert !== currentAlertRef.current) {
      currentAlertRef.current = alert;
      setExiting(false);
      setVisible(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 10000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alert, handleDismiss]);

  if (!visible || !alert) return null;

  const itemNames = alert.pendingItems.map((i) => i.name).join(", ");

  return (
    <div
      data-ocid="proximity.banner"
      className={`fixed top-0 left-0 right-0 z-50 flex items-start gap-3 px-4 py-3 bg-banner text-banner-foreground shadow-yellow
        ${exiting ? "banner-exit" : "banner-enter"}`}
      role="alert"
      aria-live="polite"
    >
      <MapPin className="h-5 w-5 mt-0.5 shrink-0" strokeWidth={2.5} />
      <div className="flex-1 min-w-0">
        <p className="font-display font-black text-sm leading-tight">
          You&apos;re near {alert.store.name}!
        </p>
        <p className="text-xs font-medium mt-0.5 leading-snug opacity-85 truncate">
          Pick up: {itemNames}
        </p>
      </div>
      <button
        type="button"
        data-ocid="proximity.banner.close_button"
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded-full hover:bg-black/15 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
