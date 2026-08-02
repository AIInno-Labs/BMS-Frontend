# Directors (“Raised by”) — Supabase setup

## Recommendation: new `directors` table (not `staff`)

| Approach | Pros | Cons |
|----------|------|------|
| **New `directors` table** ✅ | Clear ERP domain; add directors without touching floor staff; sort order & active flag; safe migrations | One extra table |
| Reuse `staff` | No new table | Mixes fabricators with directors; wrong semantics for job card “Raised by” |
| Hardcoded React array | Fast | Not scalable; no admin updates without deploy |

**Long-term:** Keep `jobs.raised_by` as `TEXT` (director **display name**) for backward compatibility. Optional later: add nullable `jobs.director_id UUID REFERENCES directors(id)` and backfill.

---

## Step 1 — Run SQL in Supabase

1. Open [Supabase Dashboard](https://supabase.com) → your project → **SQL Editor**.
2. Paste and run the full script:  
   `supabase/scripts/directors-setup.sql`  
   (or migration `supabase/migrations/20260603_directors.sql`).
3. Confirm output shows four rows: Dirk B, Steve B, Hugh, Dave.

---

## Step 2 — Deploy app (already wired)

No extra env vars. Uses existing `SUPABASE_SERVICE_ROLE_KEY` / anon key via `createSupabaseAdmin()`.

### API

- `GET /api/jobs` → `{ jobs, staff, directors }`
- `GET /api/directors` → `{ directors }`

### Backend files

- `lib/supabase/directors-repository.ts` — `listActiveDirectorsFromDb()`
- `app/api/directors/route.ts`
- `app/api/jobs/route.ts` — includes directors in payload

### Frontend files

- `context/JobsContext.tsx` — `directors`, `directorsLoading`
- `components/RaisedBySelect.tsx` — shared dropdown
- `components/JobWorkflowDashboard.tsx` — job edit modal
- `components/JobCardPrintDetailsForm.tsx` — full job card form
- `lib/jobCardFormDefaults.ts` — no longer defaults Raised by to assigned worker

### Persistence

Saving a job still writes `jobs.raised_by` via `jobToDbUpdate()` in `lib/supabase/job-mapper.ts` from `printDetails.raisedBy`.

---

## Step 3 — Add a director later

```sql
INSERT INTO public.directors (display_name, sort_order, is_active)
VALUES ('New Director', 50, TRUE);
```

Deactivate without deleting:

```sql
UPDATE public.directors SET is_active = FALSE WHERE display_name = 'Dave';
```

Refresh the app (or reload jobs) — dropdown updates automatically.

---

## Legacy jobs

If `jobs.raised_by` contains a name not in `directors`, the dropdown shows  
`(not in director list)` until the user picks a current director and saves.
