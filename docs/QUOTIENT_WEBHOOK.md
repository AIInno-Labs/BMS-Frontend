# Quotient webhook integration (native PostgreSQL)

Official docs: [Quotient Webhooks](https://www.quotientapp.com/help/quotient-webhooks)

## Production endpoint

```
https://<YOUR-DOMAIN>/api/webhooks/quotient
```

Health check: `GET` same URL.

## Environment (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook insert (bypasses RLS; trigger runs as SECURITY DEFINER) |
| `QUOTIENT_WEBHOOK_SECRET` | Bearer / `x-webhook-secret` validation |

## Three-strike safeguard (Quotient policy)

Quotient **permanently pauses** webhooks after **3 consecutive** non-2xx or timeout failures.

Our handler:

1. **Next.js (<10ms target):** validate secret → `INSERT` full `raw_payload` into `quote_events_history` → **HTTP 200** immediately.
2. **PostgreSQL (same transaction):** `AFTER INSERT` trigger `trg_quotient_webhook_process` → `process_quotient_webhook_payload()` → regex specs, `quotes`, `jobs`, `job_materials`, `job_labor`.

No Inngest, queues, or `after()` background work.

## Supported events

| `event_name` | History archive | Database action |
|--------------|-----------------|-----------------|
| `quote_sent` | Yes | Upsert `quotes` |
| `customer_viewed` | Yes | Upsert `quotes` |
| `customer_question` | Yes | Upsert `quotes` + job alert (if job exists) |
| `quote_accepted` | Yes | Job `JOB-Q-<number>`, materials, labour, regex specs on `jobs` |
| `quote_declined` | Yes | Job → `Cancelled` |
| `quote_completed` | Yes | Job → `Complete` |

## Database setup

**New project:** Supabase Dashboard → **SQL Editor** → paste entire `supabase/schema.sql` → **Run**.

**Existing project:** paste `supabase/migrations/20260527_native_webhook_trigger.sql` → **Run**.

## Local end-to-end validation

### Terminal 1 — Next.js

```powershell
cd c:\src\BMSMan
npm run dev
```

### Terminal 2 — Seed (optional demo jobs)

```powershell
npm run db:seed
```

### Terminal 3 — Webhook integration test

Set in `.env.local`:

```
QUOTIENT_WEBHOOK_SECRET=dev-webhook-secret-test
```

```powershell
npm run test:webhook
```

Expected:

- HTTP **200** with `{ ok: true, status: 200 }` in a few ms
- Within ~1s: `quote_events_history.processing_status` = `processed`
- `quotes.quotient_quote_id` = `99001`
- `jobs.id` = `JOB-Q-99001` with `resin_type` = `VEFR`, `mesh_size` = `38x38`, `colour` = `Charcoal`
- `job_materials` + `job_labor` rows with `sl_no` starting at 1 per table

## Manual replay

```sql
SELECT public.process_quotient_history_record('<history-uuid>'::uuid);
```

## Monitoring

- `quote_events_history` — audit trail, `processing_status`, `processing_error`
- Supabase → Database → Triggers — confirm `trg_quotient_webhook_process` is enabled
