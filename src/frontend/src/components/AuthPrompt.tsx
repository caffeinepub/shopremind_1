import { ShieldCheck } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function AuthPrompt() {
  const { identity } = useInternetIdentity();
  const isLoggedIn = !!identity;

  if (isLoggedIn) return null;

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl bg-primary/10 border border-primary/20 p-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
        <ShieldCheck className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground leading-tight">
          Sign in to save your list
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Tap <strong className="text-primary">Sign in</strong> at the top to
          get started — your data stays secure.
        </p>
      </div>
    </div>
  );
}
