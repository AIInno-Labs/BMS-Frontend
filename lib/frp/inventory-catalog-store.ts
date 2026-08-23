"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  addMasterInventory,
  deleteMasterInventory,
  listMasterInventory,
  updateMasterInventory,
} from "@/lib/frp/api";
import {
  catalogEntryToMasterBody,
  masterInventoryToCatalogItem,
  type InventoryCatalogEntry,
  type InventoryCatalogItem,
} from "@/lib/frp/inventory-catalog";

export type { InventoryCatalogItem };

/**
 * Org-scoped inventory catalog from GET/POST/PUT/DELETE `/master-inventory`.
 * Waits for an authenticated session so the first request is not a 401.
 */
export function useInventoryCatalog() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [items, setItems] = useState<InventoryCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMasterInventory();
      setItems(
        rows.map(masterInventoryToCatalogItem).filter((item) => item.id > 0)
      );
      setError(null);
    } catch (e) {
      setItems([]);
      setError(
        e instanceof Error ? e.message : "Could not load inventory catalog"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void reload();
  }, [authLoading, isAuthenticated, reload]);

  const addItem = useCallback(async (entry: InventoryCatalogEntry) => {
    const created = await addMasterInventory([catalogEntryToMasterBody(entry)]);
    const mapped = created.map(masterInventoryToCatalogItem);
    setItems((prev) => [...mapped, ...prev]);
    return mapped;
  }, []);

  const updateItem = useCallback(
    async (id: number, entry: InventoryCatalogEntry) => {
      const [updatedDto] = await updateMasterInventory([
        { id, ...catalogEntryToMasterBody(entry) },
      ]);
      const updated = masterInventoryToCatalogItem(updatedDto);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    []
  );

  const deleteItem = useCallback(async (id: number) => {
    await deleteMasterInventory([id]);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { items, loading, error, reload, addItem, updateItem, deleteItem };
}
