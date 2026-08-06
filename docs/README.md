# Historical docs (Supabase era)

These files describe the **retired** Next.js + Supabase data path. Domain data
now lives in **PostgreSQL via BMS-backend (Spring Boot)**.

| Doc | Status |
|---|---|
| `QUOTIENT_WEBHOOK.md` | Webhook moves to Spring Boot `POST /webhooks/quotient` (DEL-02) |
| `QUOTIENT_FIELD_MAPPING.md` | Mapping still useful; persistence is Spring Boot |
| `VERCEL_WEBHOOK_SETUP.md` | Superseded — do not configure Supabase keys |
| `DIRECTORS_RAISED_BY.md` | Directors list TBD on Spring Boot; UI allows free text |

Do **not** reintroduce `@supabase/supabase-js` or `NEXT_PUBLIC_SUPABASE_*`.
See [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) and [`../OVERVIEW.md`](../OVERVIEW.md).

### Privilege / sidebar gating (current)

Org-user sidebar items (Jobs / Quotes / Analytics) are privilege-gated via
[`../lib/frp/access.ts`](../lib/frp/access.ts) + `AppNav`. If the role lacks `JOB_READ`,
**Jobs is hidden**. Authoritative write-up:
[`../../BMS-backend/docs/PRIVILEGE_MODEL.md`](../../BMS-backend/docs/PRIVILEGE_MODEL.md) §5.1.
