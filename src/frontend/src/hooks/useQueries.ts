import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Variant_pending_bought } from "../backend.d";
import type { ShoppingItem, Store } from "../backend.d";
import { useActor } from "./useActor";

/** Returns true if an error message looks like an auth/session problem. */
function isAuthError(msg: string): boolean {
  return (
    msg.includes("not registered") ||
    msg.includes("Unauthorized") ||
    msg.includes("session") ||
    msg.includes("expired") ||
    msg.includes("Not signed in") ||
    msg.includes("Please sign in")
  );
}

export function useGetAllStores() {
  const { actor, isFetching } = useActor();
  return useQuery<Store[]>({
    queryKey: ["stores"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllStores();
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAllShoppingItems() {
  const { actor, isFetching } = useActor();
  return useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllShoppingItems();
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddStore() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      address,
      latitude,
      longitude,
    }: {
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    }) => {
      if (!actor) throw new Error("Please sign in to continue.");
      try {
        return await actor.addStore(name, address, latitude, longitude);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isAuthError(msg)) {
          // Auth may not have fully initialized yet — wait and retry once
          await new Promise((r) => setTimeout(r, 800));
          try {
            return await actor.addStore(name, address, latitude, longitude);
          } catch (retryErr) {
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : String(retryErr);
            if (isAuthError(retryMsg)) {
              throw new Error("Please sign in to continue.");
            }
            throw retryErr;
          }
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}

export function useDeleteStore() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storeId: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteStore(storeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
    },
  });
}

export function useAddShoppingItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      quantity,
      storeId,
    }: {
      name: string;
      quantity: string;
      storeId: bigint;
    }) => {
      if (!actor) throw new Error("Please sign in to continue.");
      try {
        return await actor.addShoppingItem(name, quantity, storeId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isAuthError(msg)) {
          // Auth may not have fully initialized yet — wait and retry once
          await new Promise((r) => setTimeout(r, 800));
          try {
            return await actor.addShoppingItem(name, quantity, storeId);
          } catch (retryErr) {
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : String(retryErr);
            if (isAuthError(retryMsg)) {
              throw new Error("Please sign in to continue.");
            }
            throw retryErr;
          }
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
    },
  });
}

export function useDeleteShoppingItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteShoppingItem(itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
    },
  });
}

export function useUpdateItemStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      status,
    }: {
      itemId: bigint;
      status: Variant_pending_bought;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateItemStatus(itemId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
    },
  });
}

export type { ShoppingItem, Store, Variant_pending_bought };
