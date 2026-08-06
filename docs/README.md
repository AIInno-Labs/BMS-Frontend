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

### Privilege gating (current)

| Layer | Where | Docs |
|---|---|---|
| Sidebar (MENU + ACTION) | [`../lib/frp/access.ts`](../lib/frp/access.ts) + `AppNav` | [`../../BMS-backend/docs/PRIVILEGE_MODEL.md`](../../BMS-backend/docs/PRIVILEGE_MODEL.md) §5.1 |
| Buttons (ACTION) | `can(JOBS_CREATE)` etc. | same §5.1 |
| Fields (FIELD) | `canField` / `FieldGate` + `FIELD_PRIVILEGE_MAP` | same §5.2 |
| Role picker | Org Admin Create Role: ACTION + MENU + FIELD | §4 / §5.1 |

Canonical MENU codes: `MENU_DASHBOARD`, `MENU_JOBS`, `MENU_QUOTES`, `MENU_ANALYTICS`.
Example FIELD: `FIELD_JOB_RATE` (`fieldKey=rate`) gates quote `unit_price`.
