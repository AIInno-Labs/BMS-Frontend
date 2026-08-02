# Vercel production webhook setup (Quotient)

Handoff checklist for the team member who manages **Vercel** deployment.

**Production app:** [https://frp-demo-app.vercel.app/](https://frp-demo-app.vercel.app/)

**Webhook endpoint (give this URL to Quotient):**

```text
https://frp-demo-app.vercel.app/api/webhooks/quotient
```

---

## Architecture (what you are enabling)

1. **Quotient** sends `POST` + JSON to the URL above.
2. **Next.js** (`app/api/webhooks/quotient/route.ts`) validates a shared secret and inserts one row into Supabase `quote_events_history`.
3. **PostgreSQL trigger** (`trg_quotient_webhook_process`) runs `process_quotient_webhook_payload()` and populates `quotes`, `jobs`, `job_materials`, `job_labor`.

No Inngest, queues, or background workers on Vercel.

**Database migrations (production Supabase SQL Editor, in order):**

1. `supabase/migrations/20260528_job_program_requirements.sql` — program flags on jobs  
2. `supabase/migrations/20260529_quotient_full_mirror.sql` — full Quotient fields, line items, question thread, enhanced webhook trigger  

See `docs/QUOTIENT_FIELD_MAPPING.md` for field names and the **Quotes** tab.

---

## Step 1 — Confirm production deployment

1. Log in to [Vercel](https://vercel.com).
2. Open the **BMSMan** project (domain `frp-demo-app.vercel.app`).
3. **Deployments** → latest **Production** = **Ready**.
4. After env or code changes → **Redeploy** production.

---

## Step 2 — Environment variables (Production)

**Settings** → **Environment Variables** → verify for **Production**:

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → Settings → API → `service_role` (secret) |
| `QUOTIENT_WEBHOOK_SECRET` | Yes | Generate (Step 3); must match Quotient config |

Optional (if the app already uses client Supabase):

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Never** prefix `SUPABASE_SERVICE_ROLE_KEY` or `QUOTIENT_WEBHOOK_SECRET` with `NEXT_PUBLIC_`.

**After any env change → Redeploy production.**

---

## Step 3 — Webhook secret

Generate a strong secret (32+ characters):

```bash
openssl rand -base64 32
```

1. Save as `QUOTIENT_WEBHOOK_SECRET` in Vercel (Production).
2. Share the **same value** securely with the Quotient team.
3. Quotient must send **one** of:
   - `Authorization: Bearer <secret>`
   - `x-webhook-secret: <secret>`

---

## Step 4 — Supabase (database owner)

On the **same** Supabase project the app uses:

1. Schema applied (`supabase/schema.sql` or migrations).
2. Trigger **`trg_quotient_webhook_process`** exists on `quote_events_history`.

If the trigger is missing, run in Supabase **SQL Editor**:

`supabase/migrations/20260527_native_webhook_trigger.sql`

Without the trigger, POST may return **200** but `quote_events_history.processing_status` stays `failed`.

---

## Step 5 — Smoke tests

### A) GET health check (browser)

Open:

```text
https://frp-demo-app.vercel.app/api/webhooks/quotient
```

**Expected:** JSON with `"service": "FRP Engineering Quotient Webhook"`.

| Result | Action |
|--------|--------|
| 404 | Wrong deployment or route — redeploy correct branch |
| 500 | Check Vercel function logs |
| HTML page | Wrong URL — use exact path `/api/webhooks/quotient` |

### B) POST test (PowerShell)

```powershell
$uri = "https://frp-demo-app.vercel.app/api/webhooks/quotient"
$secret = "YOUR_PRODUCTION_QUOTIENT_WEBHOOK_SECRET"

$json = '{"event_name":"quote_sent","quote_number":99101,"title":"Vercel smoke test","for":"Test Co","quote_status":"Sent","currency":"AUD","total_excludes_tax":100,"selected_items":[]}'

Invoke-RestMethod -Uri $uri -Method POST `
  -Headers @{ Authorization = "Bearer $secret"; "Content-Type" = "application/json" } `
  -Body $json
```

**Expected:** HTTP **200**, `{"ok":true,"status":200}`.

| Result | Likely cause |
|--------|----------------|
| 401 | Secret mismatch |
| 500 | Supabase env wrong or DB/trigger error |

### C) Developer test script (optional)

From repo root, `.env.local`:

```env
WEBHOOK_TEST_URL=https://frp-demo-app.vercel.app
QUOTIENT_WEBHOOK_SECRET=<same as Vercel Production>
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

```bash
npm run test:webhook
```

### D) Supabase verification

**Table Editor** → `quote_events_history`:

- New row for test quote (e.g. `99101`)
- `processing_status` = **`processed`**

---

## Step 6 — Vercel logs

**Project** → **Logs** → filter `/api/webhooks/quotient`.

Successful POSTs should show **200** without errors.

---

## Step 7 — Information for Quotient team

```text
Webhook URL:     https://frp-demo-app.vercel.app/api/webhooks/quotient
Method:          POST
Content-Type:    application/json
Authentication:  Authorization: Bearer <QUOTIENT_WEBHOOK_SECRET>
                 (or header x-webhook-secret: <same value>)

Events to enable:
  quote_sent
  customer_viewed
  customer_question
  quote_accepted
  quote_declined
  quote_completed

Expected response: HTTP 200
Body: {"ok":true,"status":200}
```

Official Quotient docs: [https://www.quotientapp.com/help/quotient-webhooks](https://www.quotientapp.com/help/quotient-webhooks)

Quotient **disables** webhooks after **3 consecutive** non-2xx responses. Test before go-live.

---

## Step 8 — After Quotient goes live

1. Quotient sends a test event.
2. Vercel logs → 200.
3. Supabase → new `quote_events_history` row, `processed`.
4. App → [Jobs](https://frp-demo-app.vercel.app/jobs) — `JOB-Q-<quote_number>` after `quote_accepted`.

---

## Checklist

- [ ] Production deployment Ready on `frp-demo-app.vercel.app`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` (Production)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Production)
- [ ] `QUOTIENT_WEBHOOK_SECRET` (Production)
- [ ] Redeploy after env changes
- [ ] GET webhook URL returns JSON
- [ ] POST with Bearer secret returns 200
- [ ] Supabase history row `processed`
- [ ] Secret shared with Quotient
- [ ] Quotient configured with full URL + auth

---

## Not required on Vercel

- Inngest or other background job services
- Docker or extra ports
- Webhook URL without `/api/webhooks/quotient`
- Sending Supabase service role key to Quotient (only the webhook secret)

---

## Related docs

- [QUOTIENT_WEBHOOK.md](./QUOTIENT_WEBHOOK.md) — local dev and event behaviour
- [supabase/schema.sql](../supabase/schema.sql) — full database blueprint
- [supabase/migrations/20260527_native_webhook_trigger.sql](../supabase/migrations/20260527_native_webhook_trigger.sql) — trigger-only migration
