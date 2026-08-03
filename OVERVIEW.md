# BMS Frontend — Architecture Overview

Operational front end for **FRP Engineering** (fibre reinforced plastic: gratings, handrails, walkways). It covers the full path from an accepted Quotient quote to a printed factory job card, plus the platform/tenant administration surface.

Package name: `bmsman`. See [README.md](./README.md) for quick start; this document covers how the app is put together.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 4 (`@tailwindcss/postcss`), Geist font |
| Charts | Recharts |
| Icons | Lucide React |
| Motion | Framer Motion |
| Data | Supabase (`@supabase/supabase-js`) |
| Scripts | `tsx`, plus Python helpers for print-layout measurement |

---

## 2. Two backends, split by concern

The app talks to **two independent backends**. Knowing which one owns what is the single most important thing about this codebase.

### 2.1 Spring Boot — identity & tenancy

`BMS-backend`, reached directly from the browser at `NEXT_PUBLIC_FRP_API_BASE_URL` (default `http://localhost:8080/api/v1`).

Owns: authentication, MFA, users, roles, privileges, organizations, application parameters.

Client: [`lib/frp/api.ts`](./lib/frp/api.ts) — a hand-rolled fetch wrapper with token injection and transparent refresh-on-401.

| Area | Endpoints |
|---|---|
| Auth | `/auth/authenticate`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| MFA | `/auth/mfa/setup`, `/auth/mfa/enable`, `/auth/mfa/verify`, `/auth/mfa/disable` |
| Tenancy | `/organizations`, `/users`, `/users/{id}/disable`, `/roles`, `/privileges` |
| Config | `/admin/parameters`, `/org/parameters` |

DTOs mirroring the Java side live in [`lib/frp/types.ts`](./lib/frp/types.ts) (`UserDTO`, `OrganizationDTO`, `RoleDTO`, `PrivilegeDTO`, `PageResponse<T>`, …).

### 2.2 Supabase — operational data

Owns: jobs, quotes, quote events, staff, directors, inventory, materials, labour, audit log.

The browser never queries Supabase directly for this data. Requests go through Next.js route handlers under [`app/api/`](./app/api/), which call repositories in [`lib/supabase/`](./lib/supabase/) using the **service-role** client. Two clients exist:

- [`lib/supabase/client.ts`](./lib/supabase/client.ts) — anon-key browser client (memoized).
- [`lib/supabase/server.ts`](./lib/supabase/server.ts) — `createSupabaseAdmin()`, service-role, bypasses RLS, no session persistence. Used by route handlers, the webhook, and seed scripts.

---

## 3. Authentication & role model

[`context/AuthContext.tsx`](./context/AuthContext.tsx) is the session authority.

- Access + refresh tokens are stored in `localStorage` (`frp_access_token`, `frp_refresh_token`).
- Login is two-step capable: `login()` returns either `{ status: "authenticated" }` or `{ status: "requires2fa", mfaToken }`, and `completeMfaLogin(mfaToken, code)` finishes the challenge.
- On mount, the provider rehydrates: if only a refresh token survives, it silently exchanges it; if `/auth/me` fails, it retries once behind a refresh before clearing the session.
- The API client is wired back to the context via `setFrpAccessTokenGetter` / `setFrpSessionUpdater`, so a refresh triggered deep inside a fetch updates React state.

### Role resolution

[`lib/frp/roles.ts`](./lib/frp/roles.ts) collapses the backend user into one of four app roles:

```
user == null                          -> "guest"
user.organization == null             -> "superadmin"   (platform-level, no tenant)
designation/roleCodes has ORG_ADMIN   -> "orgadmin"
otherwise                             -> "orguser"
```

The role drives both landing route and navigation ([`components/AppNav.tsx`](./components/AppNav.tsx)):

| Role | Home | Navigation |
|---|---|---|
| `superadmin` | `/admin` | Dashboard · Organizations · Privileges · Parameters · Security |
| `orgadmin` | `/org` | Dashboard · Users · Roles · Integrations · Security |
| `orguser` | `/` | Dashboard · Jobs · Quotes · Analytics · Security |

Finer-grained checks (`canManageOrganizations`, `canManageRoles`) additionally consult `user.rolesPrivileges` (e.g. `ORGANIZATION_CREATE`, `ROLE_READ`).

### Persona (orthogonal to role)

[`context/PersonaContext.tsx`](./context/PersonaContext.tsx) toggles between **Production Manager** and **Factory Worker** views. This is a UI/demo affordance switched in-session — it is not a security boundary and carries no server-side meaning.

---

## 4. Application shell

[`app/layout.tsx`](./app/layout.tsx) → [`components/Providers.tsx`](./components/Providers.tsx):

```
AuthProvider
└─ /login ? render bare
   └─ AuthShell            redirects to /login when unauthenticated
      └─ JobsProvider
         └─ PersonaProvider
            ├─ fixed 64-unit sidebar (FrpLogo + AppNav), mobile drawer under lg
            └─ AppHeader (sticky, in Suspense) + page content
```

Every route except `/login` is behind the auth gate. Print styles are threaded through the shell (`print:hidden`, `print:overflow-visible`) so the job card prints without chrome.

---

## 5. Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — Ready-to-Manufacture pie, KPI cards, scheduling whiteboard |
| `/jobs` | Job list, filter bar, pipeline chart, pagination |
| `/jobs/[id]` | Job card — editable traveler card, print/PDF export |
| `/quotes` | Quotient quote list |
| `/quotes/[quoteNumber]` | Quote detail — line items, question thread, event timeline |
| `/analytics` | Quotient event counts, journey/factory completion, inventory alerts |
| `/settings/security` | MFA enrolment and management |
| `/login` | Credential + MFA login |
| `/admin`, `/admin/organizations`, `/admin/privileges`, `/admin/parameters` | Platform super-admin |
| `/org`, `/org/users`, `/org/roles`, `/org/integrations` | Organization admin |

### API route handlers

| Handler | Method | Notes |
|---|---|---|
| `/api/jobs` | GET | Jobs + staff + directors in one payload |
| `/api/jobs/[jobNumber]` | GET, PATCH | Read/update a single job |
| `/api/jobs/[jobNumber]/audit` | GET | Job audit trail |
| `/api/jobs/[jobNumber]/job-card-html` | GET | Server-rendered print HTML |
| `/api/quotes`, `/api/quotes/[quoteNumber]` | GET | Quote list / detail |
| `/api/analytics` | GET | Analytics snapshot |
| `/api/directors` | GET | "Raised by" director list |
| `/api/floor/rebalance` | POST | Recompute worker assignments |
| `/api/webhooks/quotient` | GET, POST | Health check / webhook ingest |

---

## 6. Domain model

[`lib/types.ts`](./lib/types.ts) is the contract between UI, repositories, and the print layer.

**Job status** (7 states): `Pending` → `Awaiting Manager Approval` → `Ready to Manufacture` → `In Fabrication` → `On Hold` → `Complete` / `Cancelled`.

**Resin types**: Isophthalic Polyester · Vinyl Ester · Phenolic. **Priority**: Normal · High · RUSH.

A `Job` carries a Supabase `dbId` plus a public `id` (`JOB-1001`, or `JOB-Q-<quote>` for Quotient-derived jobs), client/project, dates, hours, assignment, QA flags, and a nested `printDetails: JobCardPrintDetails`.

> **Schema note:** `JobWorkflowExtras` — the long tail of job-card fields (shipment method, billing/delivery address, material rows, program history, payment state, …) — is **serialized into the `pack_dimensions` JSON column** rather than given its own columns. [`lib/supabase/pack-dimensions-json.ts`](./lib/supabase/pack-dimensions-json.ts) packs and unpacks it; [`lib/supabase/job-mapper.ts`](./lib/supabase/job-mapper.ts) and [`job-field-normalize.ts`](./lib/supabase/job-field-normalize.ts) handle row ↔ domain conversion. Anything added to `JobWorkflowExtras` needs no migration but is also not queryable in SQL.

### Database tables

From [`supabase/schema.sql`](./supabase/schema.sql): `inventory`, `quote_events_history`, `quotes`, `staff`, `jobs`, `job_audit_log`, `job_materials`, `job_labor` — plus `quote_line_items`, `quote_questions`, and `directors` added by migrations. Ten migrations in [`supabase/migrations/`](./supabase/migrations/) dated 2026-05-23 → 2026-06-03.

---

## 7. Quotient integration

The largest subsystem. Quotes originate in [Quotient](https://www.quotientapp.com); accepted quotes become factory jobs.

### Webhook design (deliberately minimal)

Quotient **permanently pauses** a webhook after 3 consecutive non-2xx responses or timeouts. The handler is built around that constraint ([`docs/QUOTIENT_WEBHOOK.md`](./docs/QUOTIENT_WEBHOOK.md)):

1. **Next.js (<10 ms target)** — validate the shared secret (`QUOTIENT_WEBHOOK_SECRET`, via bearer or `x-webhook-secret`), `INSERT` the full `raw_payload` into `quote_events_history`, return **200** immediately.
2. **PostgreSQL (same transaction)** — `AFTER INSERT` trigger `trg_quotient_webhook_process` calls `process_quotient_webhook_payload()`, which parses specs by regex and populates `quotes`, `jobs`, `job_materials`, `job_labor`.

No queues, no Inngest, no `after()` background work. `quote_events_history` doubles as an immutable audit archive.

### Event handling

| Event | Effect |
|---|---|
| `quote_sent` | Upsert `quotes` |
| `customer_viewed` | Upsert `quotes` |
| `customer_question` | Upsert `quotes` + raise a job alert if a job exists |
| `quote_accepted` | Create job `JOB-Q-<number>` + materials + labour + regex-parsed specs |
| `quote_declined` | Job → `Cancelled` |

### Mapping layer

[`lib/quotient/`](./lib/quotient/): `mapQuote.ts`, `mapToJob.ts`, `processQuote.ts`, `specParser.ts` (free-text spec → structured fields), `formatContact.ts`, `demo-payloads.ts`, plus `types.ts` / `quote-types.ts`.

Field-by-field mapping and migration order: [`docs/QUOTIENT_FIELD_MAPPING.md`](./docs/QUOTIENT_FIELD_MAPPING.md).

---

## 8. The printed job card

A substantial share of the codebase exists to reproduce a physical paper job card as a pixel-accurate PDF via `window.print()`.

- [`components/JobCardOfficialPrint.tsx`](./components/JobCardOfficialPrint.tsx) — print layout
- [`app/job-card-official-print.css`](./app/job-card-official-print.css) — print-only stylesheet
- [`lib/job-card-header-blueprint.json`](./lib/job-card-header-blueprint.json) — measured header geometry
- [`lib/jobCardPrint.ts`](./lib/jobCardPrint.ts), [`jobCardPrintHtml.ts`](./lib/jobCardPrintHtml.ts), [`openJobCardPdfPrint.ts`](./lib/openJobCardPdfPrint.ts), [`jobCardPdfFieldMap.ts`](./lib/jobCardPdfFieldMap.ts)
- [`scripts/`](./scripts/) — Python measurement tools (`measure-header.py`, `measure-blueprint-crop.py`, `extract-blueprint.py`) used to match the original form
- [`pdf.html`](./pdf.html) — reference artefact

Changes to the job card layout should be validated against the blueprint, not eyeballed.

---

## 9. Client state

Two providers hold shared state; there is no Redux/Zustand layer.

**`JobsContext`** ([`context/JobsContext.tsx`](./context/JobsContext.tsx)) — fetches `/api/jobs` (`cache: "no-store"`) and exposes `jobs`, `staff`, `directors`, `hydrated`, `loading`, `error`, plus `refreshJobs()`, `getJobById()`, `updateJob(job, audit?, auditDetail?)`, and `rebalanceFloor()`. `updateJob` takes an optional `JobUpdateAuditAction` so writes are attributed in `job_audit_log`. On load it also seeds the module-level roster in [`lib/workers.ts`](./lib/workers.ts).

**`PersonaContext`** — manager/worker toggle (see §3).

---

## 10. Supporting libraries

| Module | Responsibility |
|---|---|
| [`lib/floorOps.ts`](./lib/floorOps.ts) | Floor model — `buildFloorWorkers`, `buildFloorHealth`, `computeRebalancedAssignments`, `buildScheduleAfterRebalance` |
| [`lib/workers.ts`](./lib/workers.ts) | Staff roster cache + id ↔ display-name resolution |
| [`lib/jobStageGroups.ts`](./lib/jobStageGroups.ts) | Collapses 7 statuses into `delivered` / `manufacturing` / `not-started` for filtering and deep links |
| [`lib/jobListUtils.ts`](./lib/jobListUtils.ts), [`jobFilesSort.ts`](./lib/jobFilesSort.ts), [`jobFileThumbnail.ts`](./lib/jobFileThumbnail.ts) | List/file presentation helpers |
| [`lib/analytics/jobMetrics.ts`](./lib/analytics/jobMetrics.ts), [`lib/jobTimelineAnalytics.ts`](./lib/jobTimelineAnalytics.ts) | Derived metrics and timelines |
| [`lib/audit/`](./lib/audit/) | Audit type definitions for jobs and Quotient events |
| [`lib/statusColors.ts`](./lib/statusColors.ts) | Single source of truth for status colour tokens |
| [`lib/aiMock.ts`](./lib/aiMock.ts) | **Mock**, not a model call — `generateAiEstimate`, `getOptimizedSchedule`, `parseNaturalLanguageQuery`. Consumed by `JobCard`, `JobsList`, `JobsFilterBar` |
| [`lib/mockData.ts`](./lib/mockData.ts), [`laborMock.ts`](./lib/laborMock.ts), [`jobNotesChatDemo.ts`](./lib/jobNotesChatDemo.ts) | Demo fixtures |

---

## 11. Components

43 top-level components in [`components/`](./components/) plus 16 across `admin/`, `org/`, `ai/`, `analytics/`. The heaviest:

| Component | Lines | Role |
|---|---|---|
| `JobWorkflowDashboard.tsx` | ~1050 | Workflow board |
| `JobCard.tsx` | ~960 | Editable job card |
| `AnalyticsPage.tsx` | ~750 | Analytics screen |
| `CreateNewJobDrawer.tsx` | ~720 | Job creation flow |
| `JobWorkflowExtrasSection.tsx` | ~690 | Extended job-card fields |
| `JobsList.tsx` | ~680 | Job table |

Admin surfaces (`components/admin/`, `components/org/`) follow a consistent page + drawer pattern: `…AdminPage.tsx` for the list, `Create…Drawer.tsx` / `Edit…Drawer.tsx` for mutations, all on top of the shared [`EnterpriseDrawer.tsx`](./components/EnterpriseDrawer.tsx).

---

## 12. Environment

Copy [`.env.example`](./.env.example) to `.env.local` (never committed):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes; bypasses RLS. Required for the webhook and `db:seed` |
| `QUOTIENT_WEBHOOK_SECRET` | Webhook authentication |
| `WEBHOOK_TEST_URL` | Override for `scripts/test-webhook.ts` |
| `NEXT_PUBLIC_FRP_API_BASE_URL` | Spring Boot base URL |

---

## 13. Scripts

| Command | Effect |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run dev:reset` | Kill ports 3000/3001, clear `.next`, restart |
| `npm run dev:clean` | Clear `.next`, then start dev |
| `npm run build` | Production build (runs `prebuild` guard first) |
| `npm run db:seed` | Seed Supabase (`scripts/seed.ts`) |
| `npm run align:quotes` | Reconcile local quotes with Quotient |
| `npm run test:webhook` | Post a sample webhook payload |

### Dev-server discipline

[`.cursor/rules/next-dev.mdc`](./.cursor/rules/next-dev.mdc) encodes a hard-won rule: **never run `npm run build` while `npm run dev` is running.** They share `.next`, and doing so corrupts CSS (404 on `layout.css`, unstyled page). Run one dev server only; recover with `npm run dev:reset`. [`scripts/prebuild-guard.mjs`](./scripts/prebuild-guard.mjs) enforces this by refusing to build when ports 3000/3001 are listening.

---

## 14. Known gaps

- **`prebuild-guard.mjs` is Windows-only.** Port detection shells out to `netstat -ano | findstr ...` and checks for `LISTENING`. On macOS/Linux that command fails, the `catch` returns `false`, and the guard silently passes — the build proceeds against a live dev server, which is exactly the corruption it exists to prevent. It needs an `lsof -i :3000` (or `process.platform`) branch.
- **`README.md` is stale.** It still describes a three-feature prototype and omits Supabase, authentication, Quotient, and the entire admin surface.
- **Auth tokens live in `localStorage`**, which is XSS-readable. Acceptable for the current stage; worth revisiting against httpOnly cookies before production hardening.
- **Git history is a single commit**, so there is no incremental record of how the app evolved.
