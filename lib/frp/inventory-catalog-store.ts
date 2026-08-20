"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_INVENTORY_CATALOG,
  type InventoryCatalogEntry,
} from "@/lib/frp/inventory-catalog";

export interface InventoryCatalogItem extends InventoryCatalogEntry {
  id: string;
}

const STORAGE_PREFIX = "frp:inventoryCatalog:";
/** Fired on the window this tab changed the catalog from, so every open
 *  copy of the Job modal / admin page re-reads localStorage immediately -
 *  the native `storage` event only fires in *other* tabs. */
const CHANGE_EVENT = "frp-inventory-catalog-changed";

function storageKey(orgId: number | string | null | undefined): string {
  return `${STORAGE_PREFIX}${orgId ?? "unscoped"}`;
}

function seedDefaults(): InventoryCatalogItem[] {
  return DEFAULT_INVENTORY_CATALOG.map((entry, index) => ({
    ...entry,
    id: `default-${index}`,
  }));
}

function readFromStorage(
  orgId: number | string | null | undefined
): InventoryCatalogItem[] {
  if (typeof window === "undefined") return seedDefaults();
  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    if (!raw) return seedDefaults();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedDefaults();
    return parsed;
  } catch {
    return seedDefaults();
  }
}

function writeToStorage(
  orgId: number | string | null | undefined,
  items: InventoryCatalogItem[]
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(orgId), JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Org-scoped inventory catalog, backed by this browser's localStorage.
 * Starts seeded from DEFAULT_INVENTORY_CATALOG; an org admin's adds/edits/
 * removes on top of that are what components/org/InventoryCatalogAdminPage
 * writes, and what the Job page's Inventory modal reads for its cascading
 * Category/Profile type/Desc. 2/Desc. 3/Material grade/Colour selects.
 */
export function useInventoryCatalog() {
  const { user } = useAuth();
  const orgId = user?.organization?.id ?? null;
  const [items, setItems] = useState<InventoryCatalogItem[]>(() =>
    readFromStorage(orgId)
  );

  useEffect(() => {
    setItems(readFromStorage(orgId));
    const reload = () => setItems(readFromStorage(orgId));
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [orgId]);

  const addItem = useCallback(
    (entry: InventoryCatalogEntry) => {
      const next = [...readFromStorage(orgId), { ...entry, id: newItemId() }];
      writeToStorage(orgId, next);
      setItems(next);
    },
    [orgId]
  );

  const updateItem = useCallback(
    (id: string, entry: InventoryCatalogEntry) => {
      const next = readFromStorage(orgId).map((item) =>
        item.id === id ? { ...entry, id } : item
      );
      writeToStorage(orgId, next);
      setItems(next);
    },
    [orgId]
  );

  const deleteItem = useCallback(
    (id: string) => {
      const next = readFromStorage(orgId).filter((item) => item.id !== id);
      writeToStorage(orgId, next);
      setItems(next);
    },
    [orgId]
  );

  return { items, addItem, updateItem, deleteItem };
}
