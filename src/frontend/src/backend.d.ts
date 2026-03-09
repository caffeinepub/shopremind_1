import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ShoppingItem {
    id: bigint;
    status: Variant_pending_bought;
    storeId: bigint;
    name: string;
    createdAt: bigint;
    quantity: string;
}
export interface UserProfile {
    name: string;
}
export interface Store {
    id: bigint;
    latitude: number;
    name: string;
    longitude: number;
    address: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_pending_bought {
    pending = "pending",
    bought = "bought"
}
export interface backendInterface {
    addShoppingItem(name: string, quantity: string, storeId: bigint): Promise<bigint>;
    addStore(name: string, address: string, latitude: number, longitude: number): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deleteShoppingItem(itemId: bigint): Promise<void>;
    deleteStore(storeId: bigint): Promise<void>;
    getAllShoppingItems(): Promise<Array<ShoppingItem>>;
    getAllStores(): Promise<Array<Store>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getItemsByStore(storeId: bigint): Promise<Array<ShoppingItem>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateItemStatus(itemId: bigint, status: Variant_pending_bought): Promise<void>;
}
