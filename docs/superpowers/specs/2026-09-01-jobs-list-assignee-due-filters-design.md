# Jobs list — assignee + due presets (URL-driven)

## Goal

Add two filter controls on the Jobs list toolbar (next to **ALL STAGES** / **NEW JOB**) so managers can narrow the admin job table by assignee and due-date preset. **Filter state lives only in the URL**; the selects read from and write to query params. Existing `GET /jobs` params (`assignedTo`, `dueBefore`) do the filtering.

## Non-goals

- No new backend params (`dueAfter`, `overdue=true`, etc.)
- No worker-mode changes (worker list stays JobsContext / local)
- No “Unassigned” assignee option
- No custom date picker
- No duplicate React state as source of truth for these two filters (derive from `searchParams`)

## UI

Toolbar row (`JobsList`, non-worker only), same pill style as **ALL STAGES**:

1. **ASSIGNEE** `<select>` — `Any` + each org user from `useJobs().staff` (`display_name`, value = numeric `staff.id`)
2. **DUE** `<select>` — `Any` · `Next 7 days` · `Next 1 month` · `All overdue`
3. Existing **ALL STAGES**
4. Existing **NEW JOB** (if permitted)

Changing either control updates the URL and resets `page` (remove `page` or set to `1`, matching existing status/group behavior).

## URL query params (source of truth)

| Param | Values | Meaning |
|---|---|---|
| `assignedTo` | omitted / empty | Any assignee |
| `assignedTo` | integer user id | Filter to that user |
| `due` | omitted / empty / `any` | No due filter |
| `due` | `7d` | Next 7 days |
| `due` | `1m` | Next 1 month |
| `due` | `overdue` | All overdue |

Examples:

- `/jobs?assignedTo=9&due=overdue`
- `/jobs?due=7d&status=Pending`
- `/jobs` — both Any

Invalid `assignedTo` (non-numeric / unknown user) → treat as Any (omit from API). Unknown `due` → treat as Any.

Wire through the existing `updateUrlParams` helper (same pattern as `status` / `group` / `page`).

## API mapping

Derived from URL → `listJobs` / `GET /jobs`:

| URL | Backend |
|---|---|
| no `assignedTo` | omit `assignedTo` |
| `assignedTo={id}` | `assignedTo={id}` |
| no `due` / `any` | omit `dueBefore` |
| `due=7d` | `dueBefore=today+7` |
| `due=1m` | `dueBefore=today+30` |
| `due=overdue` | `dueBefore=yesterday` (`dueDate <= yesterday` ≡ overdue) |

Also apply the same params in stage-group mode (each status loop in `loadGroupJobs`).

Sort unchanged unless already `due_asc` / `DUE_DATE` from the existing sort control.

## Pagination caveat (Next 7 / Next 1 month)

`dueBefore` is an **upper bound only** (`dueDate <= bound`), so it also returns past-due jobs.

For `due=7d` and `due=1m`, after the page returns, keep only rows with `dueDate >= today`. That can leave a short page and slightly wrong `totalElements` until a `dueAfter` exists on the backend. Acceptable for v1.

`due=overdue` needs no client strip: `dueBefore=yesterday` is exact.

## Data source

- Assignees: `staff` from `JobsContext` (already loaded via `listUsers(0, 200)`).
- Filter values: `useSearchParams()` only.

## Empty / loading

Reuse existing empty copy; when filters yield zero rows, the current “No jobs match your filters…” message is enough.

## Out of scope follow-ups

- Backend `dueAfter` (or closed interval) for accurate “next N days” totals
- Unassigned filter
