import Nat "mo:core/Nat";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type Store = {
    id : Nat;
    name : Text;
    address : Text;
    latitude : Float;
    longitude : Float;
  };

  type ShoppingItem = {
    id : Nat;
    name : Text;
    quantity : Text;
    storeId : Nat;
    status : { #pending; #bought };
    createdAt : Int;
  };

  public type UserProfile = {
    name : Text;
  };

  // Store data
  let stores = Map.empty<Principal, Map.Map<Nat, Store>>();
  let shoppingItems = Map.empty<Principal, Map.Map<Nat, ShoppingItem>>();
  let storeIdCounter = Map.empty<Principal, Nat>();
  let itemIdCounter = Map.empty<Principal, Nat>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Initialize the user system state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  func getOrCreateStoreMap(user : Principal) : Map.Map<Nat, Store> {
    switch (stores.get(user)) {
      case (null) {
        let newMap = Map.empty<Nat, Store>();
        stores.add(user, newMap);
        newMap;
      };
      case (?map) { map };
    };
  };

  func getOrCreateItemMap(user : Principal) : Map.Map<Nat, ShoppingItem> {
    switch (shoppingItems.get(user)) {
      case (null) {
        let newMap = Map.empty<Nat, ShoppingItem>();
        shoppingItems.add(user, newMap);
        newMap;
      };
      case (?map) { map };
    };
  };

  func getAndIncrementCounterNat(counter : Map.Map<Principal, Nat>, user : Principal) : Nat {
    let current = switch (counter.get(user)) { case (null) { 0 }; case (?v) { v } };
    counter.add(user, current + 1);
    current;
  };

  public shared ({ caller }) func addStore(name : Text, address : Text, latitude : Float, longitude : Float) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add stores");
    };
    let storeId = getAndIncrementCounterNat(storeIdCounter, caller);

    let store : Store = {
      id = storeId;
      name;
      address;
      latitude;
      longitude;
    };

    let userStores = getOrCreateStoreMap(caller);
    userStores.add(storeId, store);
    storeId;
  };

  public query ({ caller }) func getAllStores() : async [Store] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view stores");
    };
    let userStores = switch (stores.get(caller)) {
      case (null) { Map.empty<Nat, Store>() };
      case (?stores) { stores };
    };
    userStores.values().toArray();
  };

  public shared ({ caller }) func deleteStore(storeId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete stores");
    };
    let userStores = getOrCreateStoreMap(caller);
    if (not userStores.containsKey(storeId)) {
      Runtime.trap("Store does not exist");
    };

    // Remove store
    userStores.remove(storeId);

    // Remove linked items
    let userItems = getOrCreateItemMap(caller);
    let itemsToRemove = userItems.entries().toArray().filter(
      func((_, item)) {
        item.storeId == storeId;
      }
    );
    for ((itemId, _) in itemsToRemove.values()) {
      userItems.remove(itemId);
    };
  };

  public shared ({ caller }) func addShoppingItem(name : Text, quantity : Text, storeId : Nat) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add shopping items");
    };
    let storeMap = getOrCreateStoreMap(caller);
    if (not storeMap.containsKey(storeId)) {
      Runtime.trap("Store does not exist");
    };
    let itemId = getAndIncrementCounterNat(itemIdCounter, caller);

    let item : ShoppingItem = {
      id = itemId;
      name;
      quantity;
      storeId;
      status = #pending;
      createdAt = 0;
    };

    let userItems = getOrCreateItemMap(caller);
    userItems.add(itemId, item);
    itemId;
  };

  public query ({ caller }) func getAllShoppingItems() : async [ShoppingItem] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view shopping items");
    };
    let userItems = switch (shoppingItems.get(caller)) {
      case (null) { Map.empty<Nat, ShoppingItem>() };
      case (?items) { items };
    };
    userItems.values().toArray();
  };

  public query ({ caller }) func getItemsByStore(storeId : Nat) : async [ShoppingItem] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view items by store");
    };
    let userItems = switch (shoppingItems.get(caller)) {
      case (null) { Map.empty<Nat, ShoppingItem>() };
      case (?items) { items };
    };
    let filteredItems = userItems.entries().toArray().filter(
      func((_, item)) {
        item.storeId == storeId;
      }
    );
    filteredItems.map<((Nat, ShoppingItem)), ShoppingItem>(
      func((_, item)) { item }
    );
  };

  public shared ({ caller }) func updateItemStatus(itemId : Nat, status : { #pending; #bought }) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update item status");
    };
    let userItems = getOrCreateItemMap(caller);
    switch (userItems.get(itemId)) {
      case (null) { Runtime.trap("Item does not exist") };
      case (?item) {
        let updatedItem = { item with status };
        userItems.add(itemId, updatedItem);
      };
    };
  };

  public shared ({ caller }) func deleteShoppingItem(itemId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete shopping items");
    };
    let userItems = getOrCreateItemMap(caller);
    if (not userItems.containsKey(itemId)) {
      Runtime.trap("Item does not exist");
    };
    userItems.remove(itemId);
  };
};
