import { Toaster } from "@/components/ui/sonner";
import {
  Bell,
  Crosshair,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  ShoppingCart,
  Sun,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Variant_pending_bought } from "./backend.d";
import { AuthPrompt } from "./components/AuthPrompt";
import { LocationsTab } from "./components/LocationsTab";
import { MyListTab } from "./components/MyListTab";
import { ProximityBanner } from "./components/ProximityBanner";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { type ProximityAlert, useProximity } from "./hooks/useProximity";
import { useGetAllShoppingItems, useGetAllStores } from "./hooks/useQueries";
import { useTheme } from "./hooks/useTheme";

type ActiveTab = "list" | "locations";

function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("list");
  const [proximityAlert, setProximityAlert] = useState<ProximityAlert | null>(
    null,
  );
  const { theme, toggleTheme } = useTheme();
  const { data: stores = [] } = useGetAllStores();
  const { data: items = [] } = useGetAllShoppingItems();
  const { identity, login, clear, loginStatus } = useInternetIdentity();
  const isLoggedIn = !!identity;
  const isLoggingIn = loginStatus === "logging-in";

  const handleProximityAlert = useCallback((alert: ProximityAlert) => {
    setProximityAlert(alert);
    toast.success(
      `Near ${alert.store.name}! ${alert.pendingItems.length} item(s) to pick up.`,
      { duration: 6000 },
    );
  }, []);

  const handleDismissBanner = useCallback(() => {
    setProximityAlert(null);
  }, []);

  const simulateProximity = useCallback(() => {
    const storeWithPending = stores.find((store) =>
      items.some(
        (item) =>
          item.storeId === store.id &&
          item.status === Variant_pending_bought.pending,
      ),
    );

    if (!storeWithPending) {
      toast.warning("No stores with pending items found.");
      return;
    }

    const pendingItems = items.filter(
      (item) =>
        item.storeId === storeWithPending.id &&
        item.status === Variant_pending_bought.pending,
    );

    handleProximityAlert({ store: storeWithPending, pendingItems });
  }, [stores, items, handleProximityAlert]);

  useProximity({
    stores,
    items,
    onAlert: handleProximityAlert,
  });

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col h-screen relative bg-background overflow-hidden">
        <ProximityBanner
          alert={proximityAlert}
          onDismiss={handleDismissBanner}
        />

        <header className="shrink-0 flex items-center justify-between px-5 pt-safe-top py-4 border-b border-border bg-background/95 backdrop-blur-sm z-20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-yellow-sm">
              <Bell
                className="h-4 w-4 text-primary-foreground"
                strokeWidth={2.5}
              />
            </div>
            <span className="font-display font-black text-xl tracking-tight text-foreground">
              MemoMap
            </span>
          </div>
          <div className="flex items-center gap-2">
            {stores.length > 0 && (
              <button
                type="button"
                data-ocid="simulate.proximity.button"
                onClick={simulateProximity}
                className="h-9 w-9 rounded-full bg-muted hover:bg-primary/20 flex items-center justify-center transition-colors text-muted-foreground hover:text-primary"
                aria-label="Simulate proximity alert"
                title="Simulate proximity alert"
              >
                <Crosshair className="h-[18px] w-[18px]" />
              </button>
            )}
            <button
              type="button"
              data-ocid="theme.toggle"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </button>

            {isLoggedIn ? (
              <button
                type="button"
                data-ocid="auth.sign_out.button"
                onClick={clear}
                className="h-9 flex items-center gap-1.5 px-3 rounded-full bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground text-xs font-semibold"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-[15px] w-[15px]" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <button
                type="button"
                data-ocid="auth.sign_in.button"
                onClick={login}
                disabled={isLoggingIn}
                className="h-9 flex items-center gap-1.5 px-3 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors text-primary text-xs font-bold disabled:opacity-60"
                aria-label="Sign in"
                title="Sign in"
              >
                {isLoggingIn ? (
                  <Loader2 className="h-[15px] w-[15px] animate-spin" />
                ) : (
                  <LogIn className="h-[15px] w-[15px]" />
                )}
                <span>{isLoggingIn ? "Signing in…" : "Sign in"}</span>
              </button>
            )}
          </div>
        </header>

        <AuthPrompt />

        <main className="flex-1 overflow-hidden relative">
          <div
            className={`absolute inset-0 transition-opacity duration-200 ${activeTab === "list" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          >
            <MyListTab />
          </div>
          <div
            className={`absolute inset-0 transition-opacity duration-200 ${activeTab === "locations" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          >
            <LocationsTab />
          </div>
        </main>

        <nav
          className="shrink-0 border-t border-border bg-nav pb-safe z-20"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
          }}
        >
          <div className="flex">
            <button
              type="button"
              data-ocid="nav.my_list.tab"
              onClick={() => setActiveTab("list")}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-150 ${
                activeTab === "list"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="My List"
              aria-current={activeTab === "list" ? "page" : undefined}
            >
              <div
                className={`relative transition-all duration-200 ${activeTab === "list" ? "scale-110" : "scale-100"}`}
              >
                <ShoppingCart className="h-5 w-5" strokeWidth={2} />
                {activeTab === "list" && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <span
                className={`text-[11px] font-bold tracking-wide transition-all ${activeTab === "list" ? "opacity-100" : "opacity-60"}`}
              >
                My List
              </span>
            </button>

            <button
              type="button"
              data-ocid="nav.locations.tab"
              onClick={() => setActiveTab("locations")}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-150 ${
                activeTab === "locations"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Locations"
              aria-current={activeTab === "locations" ? "page" : undefined}
            >
              <div
                className={`relative transition-all duration-200 ${activeTab === "locations" ? "scale-110" : "scale-100"}`}
              >
                <MapPin className="h-5 w-5" strokeWidth={2} />
                {activeTab === "locations" && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <span
                className={`text-[11px] font-bold tracking-wide transition-all ${activeTab === "locations" ? "opacity-100" : "opacity-60"}`}
              >
                Locations
              </span>
            </button>
          </div>
          <div className="py-1 text-center">
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              Built with ♥ using caffeine.ai
            </a>
          </div>
        </nav>
      </div>

      <Toaster
        position="top-center"
        toastOptions={{ style: { maxWidth: "380px" } }}
      />
    </div>
  );
}

function DesktopBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background relative">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none hidden md:block"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.87 0.18 92) 1px, transparent 1px), linear-gradient(90deg, oklch(0.87 0.18 92) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <DesktopBackground>
      <AppShell />
    </DesktopBackground>
  );
}
