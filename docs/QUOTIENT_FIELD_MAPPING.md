# Quotient field mapping (FRP Engineering)

Quotient webhook field names are used on the **Quotes** tab and in read-only blocks on Quotient-linked job cards. **Jobs** remain the official factory PDF job card (editable layout unchanged).

## Apply database changes

Run in Supabase SQL Editor (in order if upgrading):

1. `supabase/migrations/20260528_job_program_requirements.sql`
2. `supabase/migrations/20260529_quotient_full_mirror.sql`

New projects: full `supabase/schema.sql` after it is updated, or run both migrations.

## Navigation

| Tab | Purpose |
|-----|---------|
| **Quotes** | Full Quotient snapshot, line items, question thread, event timeline |
| **Jobs** | Factory PDF job card (edit packs, clips, worker, workflow) |
| **Analytics** | Event counts + journey / factory completion on recent events |

## Key tables

| Table | Role |
|-------|------|
| `quote_events_history` | Immutable webhook archive (`raw_payload`) |
| `quotes` | Latest Quotient snapshot per `quotient_quote_id` (= `quote_number`) |
| `quote_line_items` | `selected_items[]` (many rows per quote) |
| `quote_questions` | Full `customer_question` conversation thread |
| `jobs` | `JOB-Q-{quote_number}` factory execution |

## Status fields (no need to open Jobs)

| Column | Meaning |
|--------|---------|
| `journey_outcome` | `open` \| `accepted` \| `declined` \| `completed` |
| `factory_job_status` | Copy of `jobs.workflow_status` when job exists |
| `last_event_name` | Last webhook `event_name` |

## Inspect a quote

```powershell
npx tsx scripts/inspect-quote.ts 111111
```
