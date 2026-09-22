# Jobs list assignee + due URL filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-driven Assignee and Due preset filters to the Jobs list toolbar, wired into existing `GET /jobs` `assignedTo` / `dueBefore` params.

**Architecture:** Pure helpers parse URL `assignedTo` / `due` into list API args and optional client post-filters. `JobsList` derives values from `useSearchParams`, writes via `updateUrlParams`, and passes args into both default and stage-group `listJobs` fetches. Staff names come from `useJobs().staff`.

**Tech Stack:** Next.js App Router (`useSearchParams` / `router.replace`), React, existing `listJobs` in `lib/frp/api.ts`.

## Global Constraints

- Filter state lives **only** in the URL (`assignedTo`, `due`) — no parallel React state as source of truth.
- Due URL values: omitted/`any` | `7d` | `1m` | `overdue`.
- Assignee: omitted = Any; integer user id = filter; invalid → treat as Any.
- UI: same pill style as ALL STAGES; non-worker toolbar only.
- No new backend params; no Unassigned option; no worker-mode changes.
- Spec: `docs/superpowers/specs/2026-09-01-jobs-list-assignee-due-filters-design.md`.

---

## File map

| File | Role |
|---|---|
| Create: `FRP-frontend/lib/jobListUrlFilters.ts` | Parse URL → API args + client due keep predicate |
| Modify: `FRP-frontend/components/JobsList.tsx` | Toolbar selects + pass filters into `listJobs` |
| Verify: `npx tsx` one-liners / `npx tsc --noEmit` (no Jest in this package) |

---

### Task 1: URL filter helpers

**Files:**
- Create: `FRP-frontend/lib/jobListUrlFilters.ts`

**Interfaces:**
- Produces:
  - `JobListDuePreset = "any" | "7d" | "1m" | "overdue"`
  - `parseAssignedToParam(raw: string | null): number | undefined`
  - `parseDuePresetParam(raw: string | null): JobListDuePreset`
  - `duePresetToDueBefore(preset: JobListDuePreset, todayIso: string): string | undefined`
  - `shouldKeepJobForDuePreset(preset: JobListDuePreset, dueDate: string | null | undefined, todayIso: string): boolean`

- [ ] **Step 1: Add helper module**

Create `FRP-frontend/lib/jobListUrlFilters.ts`:

```ts
export type JobListDuePreset = "any" | "7d" | "1m" | "overdue";

/** ISO yyyy-MM-dd + calendar day delta at local noon. */
export function isoDatePlusDaysFrom(todayIso: string, days: number): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function parseAssignedToParam(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function parseDuePresetParam(raw: string | null): JobListDuePreset {
  if (raw === "7d" || raw === "1m" || raw === "overdue") return raw;
  return "any";
}

/** Maps URL due preset → GET /jobs `dueBefore` (omit when any). */
export function duePresetToDueBefore(
  preset: JobListDuePreset,
  todayIso: string
): string | undefined {
  if (preset === "any") return undefined;
  if (preset === "7d") return isoDatePlusDaysFrom(todayIso, 7);
  if (preset === "1m") return isoDatePlusDaysFrom(todayIso, 30);
  // overdue: dueDate <= yesterday
  return isoDatePlusDaysFrom(todayIso, -1);
}

/**
 * Client keep after `dueBefore` page load.
 * For 7d/1m, drop past-due rows (API upper-bound only).
 * For overdue/any, keep all returned rows.
 */
export function shouldKeepJobForDuePreset(
  preset: JobListDuePreset,
  dueDate: string | null | undefined,
  todayIso: string
): boolean {
  if (preset === "any" || preset === "overdue") return true;
  if (!dueDate) return false;
  return dueDate >= todayIso;
}
```

- [ ] **Step 2: Verify helpers with tsx**

Run from `FRP-frontend`:

```bash
npx tsx -e "
import {
  parseAssignedToParam,
  parseDuePresetParam,
  duePresetToDueBefore,
  shouldKeepJobForDuePreset,
} from './lib/jobListUrlFilters.ts';

const today = '2026-09-01';
console.assert(parseAssignedToParam(null) === undefined);
console.assert(parseAssignedToParam('9') === 9);
console.assert(parseAssignedToParam('x') === undefined);
console.assert(parseDuePresetParam('7d') === '7d');
console.assert(parseDuePresetParam('nope') === 'any');
console.assert(duePresetToDueBefore('overdue', today) === '2026-08-31');
console.assert(duePresetToDueBefore('7d', today) === '2026-09-08');
console.assert(duePresetToDueBefore('1m', today) === '2026-10-01');
console.assert(shouldKeepJobForDuePreset('7d', '2026-08-30', today) === false);
console.assert(shouldKeepJobForDuePreset('7d', '2026-09-03', today) === true);
console.assert(shouldKeepJobForDuePreset('overdue', '2026-08-30', today) === true);
console.log('ok');
"
```

Expected: `ok`

- [ ] **Step 3: Commit** (only if user asked to commit)

```bash
git add lib/jobListUrlFilters.ts
git commit -m "$(cat <<'EOF'
Add URL helpers for jobs list assignee and due presets.

EOF
)"
```

Skip commit unless the user explicitly requested commits.

---

### Task 2: Wire filters into JobsList fetches + toolbar

**Files:**
- Modify: `FRP-frontend/components/JobsList.tsx`

**Interfaces:**
- Consumes: helpers from Task 1; `staff` from `useJobs()`; `listJobs` already supports `assignedTo` / `dueBefore`
- Produces: URL `?assignedTo=` / `?due=` drive the admin table

- [ ] **Step 1: Import helpers and read URL + staff**

Near top imports, add:

```ts
import {
  duePresetToDueBefore,
  parseAssignedToParam,
  parseDuePresetParam,
  shouldKeepJobForDuePreset,
  type JobListDuePreset,
} from "@/lib/jobListUrlFilters";
```

Inside `JobsList`, change:

```ts
const { counts } = useJobs();
```

to:

```ts
const { counts, staff } = useJobs();
```

After `searchParams` is available, derive (no useState):

```ts
const assignedToFilter = parseAssignedToParam(searchParams.get("assignedTo"));
const duePreset = parseDuePresetParam(searchParams.get("due"));

function todayIsoLocal(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
```

(Or inline the same ISO helper once at module scope if preferred.)

- [ ] **Step 2: Pass filters into default `listJobs` effect**

In the admin default fetch effect (`listJobs(page - 1, JOBS_PAGE_SIZE, { ... })`), add:

```ts
const today = todayIsoLocal();
const dueBefore = duePresetToDueBefore(duePreset, today);

listJobs(page - 1, JOBS_PAGE_SIZE, {
  search,
  sort: toBackendSort(sortBy),
  status: explicitStatus ?? impliedStatus,
  priority,
  assignedTo: assignedToFilter,
  dueBefore,
})
  .then((res) => {
    if (cancelled) return;
    const rows = (res.content ?? [])
      .map(frpJobSummaryToUi)
      .filter((job) =>
        shouldKeepJobForDuePreset(duePreset, job.dueDate, today)
      );
    setDefaultRows(rows);
    // Keep backend totals for pagination; short pages for 7d/1m are accepted per spec.
    setDefaultTotalItems(res.totalElements ?? 0);
    const total = Math.max(1, res.totalPages ?? 1);
    setDefaultTotalPages(total);
    if (page > total) setPage(total);
  })
```

Add `assignedToFilter` and `duePreset` to the effect dependency array.

- [ ] **Step 3: Pass filters into stage-group `loadGroupJobs`**

Where `listJobs(backendPage, 200, { status, sort: "RECENT" })` runs, change to:

```ts
const today = todayIsoLocal();
const dueBefore = duePresetToDueBefore(duePreset, today);
// ...
const res = await listJobs(backendPage, 200, {
  status,
  sort: "RECENT",
  assignedTo: assignedToFilter,
  dueBefore,
});
```

After collecting/mapping UI jobs (before local sort/paginate), filter:

```ts
const kept = collected.filter((job) =>
  shouldKeepJobForDuePreset(duePreset, job.dueDate, today)
);
```

Use `kept` for the rest of group mode. Add `assignedToFilter` / `duePreset` to that effect’s deps.

- [ ] **Step 4: Add ASSIGNEE + DUE selects in the toolbar**

In the non-worker toolbar (`flex flex-wrap items-center justify-end gap-2`), **before** the ALL STAGES label, insert two pills matching ALL STAGES styling:

```tsx
<label className="inline-flex h-[46px] min-w-0 items-center justify-between rounded-full border border-[#E5E7EB] bg-white px-3 text-[11px] font-semibold tracking-wide text-[#111827] focus-within:border-orange-300/45 focus-within:ring-2 focus-within:ring-orange-200/40">
  <span className="shrink-0">ASSIGNEE</span>
  <select
    value={assignedToFilter != null ? String(assignedToFilter) : ""}
    onChange={(e) => {
      const v = e.target.value;
      setPage(1);
      updateUrlParams({
        assignedTo: v ? v : null,
        page: null,
      });
    }}
    className="ml-2 min-w-0 max-w-40 truncate bg-transparent text-[11px] outline-none hover:text-[#EA580C]"
    aria-label="Filter assignee"
  >
    <option value="">Any</option>
    {staff.map((u) => (
      <option key={u.id} value={u.id}>
        {u.display_name}
      </option>
    ))}
  </select>
</label>

<label className="inline-flex h-[46px] min-w-0 items-center justify-between rounded-full border border-[#E5E7EB] bg-white px-3 text-[11px] font-semibold tracking-wide text-[#111827] focus-within:border-orange-300/45 focus-within:ring-2 focus-within:ring-orange-200/40">
  <span className="shrink-0">DUE</span>
  <select
    value={duePreset === "any" ? "" : duePreset}
    onChange={(e) => {
      const v = e.target.value as "" | Exclude<JobListDuePreset, "any">;
      setPage(1);
      updateUrlParams({
        due: v ? v : null,
        page: null,
      });
    }}
    className="ml-2 min-w-0 max-w-36 truncate bg-transparent text-[11px] outline-none hover:text-[#EA580C]"
    aria-label="Filter due date"
  >
    <option value="">Any</option>
    <option value="7d">Next 7 days</option>
    <option value="1m">Next 1 month</option>
    <option value="overdue">All overdue</option>
  </select>
</label>
```

Order: **ASSIGNEE → DUE → ALL STAGES → NEW JOB**.

- [ ] **Step 5: Typecheck**

```bash
cd FRP-frontend && npx tsc --noEmit
```

Expected: no errors from these files.

- [ ] **Step 6: Manual check**

1. Open `/jobs` — both selects show Any; list unchanged.
2. Pick an assignee — URL has `?assignedTo={id}`; table only that user’s jobs.
3. Set `due=overdue` — URL updates; only past-due jobs.
4. Set `due=7d` — upcoming within 7 days (no past-due rows in the table).
5. Reload the URL — filters restore from query string.
6. Worker persona — new selects not shown.

- [ ] **Step 7: Commit** (only if user asked)

```bash
git add components/JobsList.tsx lib/jobListUrlFilters.ts
git commit -m "$(cat <<'EOF'
Add URL-driven assignee and due filters on the jobs list.

EOF
)"
```

---

## Spec coverage check

| Spec item | Task |
|---|---|
| ASSIGNEE + DUE pills | Task 2 Step 4 |
| URL `assignedTo` / `due=7d\|1m\|overdue` | Task 1 + Task 2 Step 1/4 |
| Map to `assignedTo` / `dueBefore` | Task 1 + Task 2 Steps 2–3 |
| Stage-group mode same params | Task 2 Step 3 |
| Client keep for 7d/1m | Task 1 `shouldKeepJobForDuePreset` + Task 2 Steps 2–3 |
| Overdue = yesterday | Task 1 `duePresetToDueBefore` |
| staff from JobsContext | Task 2 Step 1 |
| No worker changes | Task 2 Step 4 gated by `!isWorker` toolbar |
