import { Skeleton } from "@/components/ui/skeleton";

export function ItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
      <Skeleton className="h-5 w-5 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-7 w-7 rounded-full" />
    </div>
  );
}

export function StoreSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-2">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
