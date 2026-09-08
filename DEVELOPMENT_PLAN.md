# BMS Frontend — Development Plan

Living tracker for this repo (`bmsman`). Update when a slice lands.

| | |
|---|---|
| **Branch** | `del-1` |
| **Direction** | Talk only to **Spring Boot + PostgreSQL**; Supabase DB/client fully removed from this repo |
| **ORM / DB** | **None in the frontend.** No Prisma. Browser → Spring Boot APIs only (`NEXT_PUBLIC_FRP_API_BASE_URL`). Persistence is backend JPA/Hibernate. |
| **Last updated** | 2026-08-04 |
| **Related** | [`OVERVIEW.md`](./OVERVIEW.md) · [`.env.example`](./.env.example) · Backend plan: [`../BMS-backend/DEVELOPMENT_PLAN.md`](../BMS-backend/DEVELOPMENT_PLAN.md) |

> **Stack decision (2026-08-04):** PRD §1.2 named Prisma, but we use **Spring Boot JPA/Hibernate** on the backend. The frontend does **not** connect to the database and does **not** need Prisma.

---

## Status legend

| Status | Meaning |
|---|---|
| Done | On `del-1` (may be uncommitted) |
| In progress | Partially wired |
| Not started | Waiting on backend / later DEL |
| Blocked | Waiting on client / dependency |

---

## 1. Done

| Item | Status | Notes |
|---|---|---|
| RBAC role resolution + login redirects | Done | `lib/frp/roles.ts` |
| Remove `@supabase/supabase-js` | Done | Package uninstalled |
| Delete `lib/supabase/` + `supabase/` SQL | Done | No frontend DB schema or client left |
| Delete Supabase seed / align / inspect scripts | Done | `package.json` scripts are no-ops |
| `JobsContext` → Spring Boot `/jobs` | Done | JWT via `lib/frp/api.ts` |
| Create / update / audit jobs via FRP | Done | `job-mapper.ts`, `job-audit.ts` |
| Quotes / job-card quote enrich via FRP | Done | Graceful empty until backend DEL-02 |
| Raised-by free text (no Supabase directors) | Done | `RaisedBySelect` |
| Env: FRP URL + Quotient/SharePoint keys | Done | `.env` / `.env.example` |
| `OVERVIEW.md` — Spring Boot as only data plane | Done | |

---

## 2. In progress

| Item | Status | Notes |
|---|---|---|
| Commit cutover on `del-1` | In progress | Local changes uncommitted |
| Quotes / analytics live data | In progress | Needs backend DEL-02 |
| Job print HTML proxy | In progress | Bearer → Spring Boot |
| Staff / directors / floor | In progress | Empty until backend APIs |

---

## 3. Not started (frontend)

- [ ] Live Quotes + Quotient analytics (DEL-02)
- [ ] SharePoint job panel
- [ ] PO / variance UI (DEL-03+)

---

## 4. Environment

```bash
NEXT_PUBLIC_FRP_API_BASE_URL=http://localhost:8080/api/v1
# + QUOTIENT_* / SHAREPOINT_* — see .env.example
```

No `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY`.

---

## 5. Next steps

1. Commit frontend Supabase removal on `del-1`.
2. Smoke-test org user jobs against Spring Boot Postgres.
3. After backend DEL-02, wire Quotes/Analytics fully.

---

## 6. Session log

| Date | What landed |
|---|---|
| 2026-08-04 | RBAC reviewed; Spring Boot jobs cutover; Supabase package removed. |
| 2026-08-04 | Env + OVERVIEW; per-repo DEVELOPMENT_PLAN. |
| 2026-08-04 | Deleted `lib/supabase/`, `supabase/` SQL, seed scripts; jobs only via Spring Boot. |
| 2026-08-04 | Confirmed: no Prisma on frontend; DB access is Spring Boot JPA/Hibernate only. |

*Append to §6; update §1–§3 instead of rewriting history.*
