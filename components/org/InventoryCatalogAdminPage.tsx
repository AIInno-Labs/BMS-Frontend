"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
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

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const EMPTY_FORM: InventoryCatalogEntry = {
  productGroup: "",
  profileType: "",
  meshSpec: "",
  dimension: "",
  resin: "",
  colour: "",
};

function normalized(entry: InventoryCatalogEntry): string {
  return [
    entry.productGroup,
    entry.profileType,
    entry.meshSpec,
    entry.dimension,
    entry.resin,
    entry.colour,
  ]
    .map((v) => v.trim().toLowerCase())
    .join("|");
}

export function InventoryCatalogAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InventoryCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryCatalogItem | null>(null);
  const [form, setForm] = useState<InventoryCatalogEntry>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<InventoryCatalogItem | null>(
    null
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [profileTypeFilter, setProfileTypeFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "orgadmin") {
      router.replace(appRole === "superadmin" ? "/admin" : "/");
    }
  }, [authLoading, isAuthenticated, appRole, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || appRole !== "orgadmin") return;
    let cancelled = false;
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const rows = await listMasterInventory();
        if (cancelled) return;
        setItems(
          rows.map(masterInventoryToCatalogItem).filter((item) => item.id > 0)
        );
        setCatalogError(null);
      } catch (e) {
        if (cancelled) return;
        setItems([]);
        setCatalogError(
          e instanceof Error ? e.message : "Could not load inventory catalog"
        );
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, appRole]);

  const categories = useMemo(
    () =>
      [...new Set(items.map((item) => item.productGroup))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [items]
  );

  const scopedByCategory = useMemo(
    () =>
      items.filter(
        (item) => !categoryFilter || item.productGroup === categoryFilter
      ),
    [items, categoryFilter]
  );

  const profileTypes = useMemo(
    () =>
      [...new Set(scopedByCategory.map((item) => item.profileType).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [scopedByCategory]
  );

  const scopedByProfile = useMemo(
    () =>
      scopedByCategory.filter(
        (item) => !profileTypeFilter || item.profileType === profileTypeFilter
      ),
    [scopedByCategory, profileTypeFilter]
  );

  const materials = useMemo(
    () =>
      [...new Set(scopedByProfile.map((item) => item.resin).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [scopedByProfile]
  );

  const hasActiveFilter =
    Boolean(categoryFilter) ||
    Boolean(profileTypeFilter) ||
    Boolean(materialFilter);

  function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    setProfileTypeFilter("");
    setMaterialFilter("");
  }

  function handleProfileTypeFilterChange(value: string) {
    setProfileTypeFilter(value);
    setMaterialFilter("");
  }

  const sorted = useMemo(
    () =>
      scopedByProfile
        .filter((item) => !materialFilter || item.resin === materialFilter)
        .sort(
          (a, b) =>
            a.productGroup.localeCompare(b.productGroup) ||
            a.profileType.localeCompare(b.profileType)
        ),
    [scopedByProfile, materialFilter]
  );

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(item: InventoryCatalogItem) {
    setEditItem(item);
    setForm({
      productGroup: item.productGroup,
      profileType: item.profileType,
      meshSpec: item.meshSpec,
      dimension: item.dimension,
      resin: item.resin,
      colour: item.colour,
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditItem(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.productGroup.trim() || !form.profileType.trim()) {
      setFormError("Product Group and Attribute 1 are required.");
      return;
    }
    const entry: InventoryCatalogEntry = {
      productGroup: form.productGroup.trim(),
      profileType: form.profileType.trim(),
      meshSpec: form.meshSpec.trim(),
      dimension: form.dimension.trim(),
      resin: form.resin.trim(),
      colour: form.colour.trim(),
    };
    const duplicate = items.find(
      (item) => item.id !== editItem?.id && normalized(item) === normalized(entry)
    );
    if (duplicate) {
      setFormError(
        "An identical item already exists in the catalog (same Product Group, Attribute 1, Attribute 2, Attribute 3, Resin/Material and Primary Colour)."
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editItem) {
        const updated = masterInventoryToCatalogItem(
          await updateMasterInventory(editItem.id, catalogEntryToMasterBody(entry))
        );
        setItems((prev) =>
          prev.map((item) => (item.id === editItem.id ? updated : item))
        );
      } else {
        const created = (
          await addMasterInventory([catalogEntryToMasterBody(entry)])
        ).map(masterInventoryToCatalogItem);
        setItems((prev) => [...created, ...prev]);
      }
      closeDrawer();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save catalog item");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !isAuthenticated || appRole !== "orgadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Organization Admin
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">
              Inventory
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Products your team can choose from when adding inventory to a
              job. Loaded from the org master inventory catalogue.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </div>
        </div>

        {catalogError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {catalogError}
          </p>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Product Group
            <select
              className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-[#111827] outline-none focus:border-orange-300"
              value={categoryFilter}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
            >
              <option value="">All ({items.length})</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category} (
                  {items.filter((item) => item.productGroup === category).length})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Attribute 1
            <select
              className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-[#111827] outline-none focus:border-orange-300"
              value={profileTypeFilter}
              onChange={(e) => handleProfileTypeFilterChange(e.target.value)}
            >
              <option value="">All</option>
              {profileTypes.map((profileType) => (
                <option key={profileType} value={profileType}>
                  {profileType}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Resin / Material
            <select
              className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-[#111827] outline-none focus:border-orange-300"
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
            >
              <option value="">All</option>
              {materials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product Group</th>
                  <th className="px-4 py-3">Attribute 1</th>
                  <th className="px-4 py-3">Attribute 2</th>
                  <th className="px-4 py-3">Attribute 3</th>
                  <th className="px-4 py-3">Resin / Material</th>
                  <th className="px-4 py-3">Primary Colour</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      Loading catalog…
                    </td>
                  </tr>
                )}
                {!catalogLoading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Package className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {hasActiveFilter
                          ? "No items match this filter"
                          : "No catalog items yet"}
                      </p>
                    </td>
                  </tr>
                )}
                {!catalogLoading &&
                  sorted.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${
                      idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {item.productGroup}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.profileType}</td>
                    <td className="px-4 py-3 text-slate-600">{item.meshSpec || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.dimension || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.resin || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.colour || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-orange-50"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <EnterpriseDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editItem ? "Edit inventory item" : "Add inventory item"}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={closeDrawer}>
              Cancel
            </button>
            <button type="submit" form="inventory-catalog-form" className="btn-primary" disabled={saving}>
              {editItem ? "Save changes" : "Add item"}
            </button>
          </div>
        }
      >
        <form id="inventory-catalog-form" onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          <label className={labelClass}>
            Product Group
            <input
              className={inputClass}
              value={form.productGroup}
              placeholder="e.g. Grating - Moulded"
              onChange={(e) => setForm((f) => ({ ...f, productGroup: e.target.value }))}
            />
          </label>
          <label className={labelClass}>
            Attribute 1
            <input
              className={inputClass}
              value={form.profileType}
              placeholder="e.g. 38mm thick"
              onChange={(e) => setForm((f) => ({ ...f, profileType: e.target.value }))}
            />
          </label>
          <label className={labelClass}>
            Attribute 2
            <input
              className={inputClass}
              value={form.meshSpec}
              placeholder="e.g. 38 square mesh"
              onChange={(e) => setForm((f) => ({ ...f, meshSpec: e.target.value }))}
            />
          </label>
          <label className={labelClass}>
            Attribute 3
            <input
              className={inputClass}
              value={form.dimension}
              placeholder="e.g. 1220 x 3660"
              onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))}
            />
          </label>
          <label className={labelClass}>
            Resin / Material
            <input
              className={inputClass}
              value={form.resin}
              placeholder="e.g. IsoFR"
              onChange={(e) => setForm((f) => ({ ...f, resin: e.target.value }))}
            />
          </label>
          <label className={labelClass}>
            Primary Colour
            <input
              className={inputClass}
              value={form.colour}
              placeholder="e.g. Yellow"
              onChange={(e) => setForm((f) => ({ ...f, colour: e.target.value }))}
            />
          </label>
        </form>
      </EnterpriseDrawer>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete catalog item?"
        description={
          deleteTarget
            ? `"${deleteTarget.productGroup} / ${deleteTarget.profileType}" will no longer be selectable when adding job inventory. This does not change any inventory lines already on existing jobs.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          void deleteMasterInventory(id)
            .then(() => setItems((prev) => prev.filter((item) => item.id !== id)))
            .finally(() => setDeleteTarget(null));
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </main>
  );
}
