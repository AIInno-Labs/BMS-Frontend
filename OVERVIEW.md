# BMS Frontend — Architecture Overview

Operational front end for **FRP Engineering** (fibre reinforced plastic: gratings, handrails, walkways). It covers the full path from an accepted Quotient quote to a printed factory job card, plus the platform/tenant administration surface.

Package name: `bmsman`. See [README.md](./README.md) for quick start; this document covers how the app is put together. Progress vs deliverables: [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md).

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
| Data | Spring Boot (`NEXT_PUBLIC_FRP_API_BASE_URL`) via [`lib/frp/api.ts`](./lib/frp/api.ts) |
| Scripts | `tsx`, plus Python helpers for print-layout measurement |

---

## 2. Backend — Spring Boot (identity + domain)

`BMS-backend`, reached directly from the browser at `NEXT_PUBLIC_FRP_API_BASE_URL` (default `http://localhost:8080/api/v1`).

Owns: authentication, MFA, users, roles, privileges, organizations, application parameters, **jobs**, **customers**, and (DEL-02+) quotes / Quotient webhook.

Client: [`lib/frp/api.ts`](./lib/frp/api.ts) — fetch wrapper with token injection and transparent refresh-on-401. Job DTO mapping lives in [`lib/frp/job-mapper.ts`](./lib/frp/job-mapper.ts); OpenAPI types in [`lib/frp/schema.d.ts`](./lib/frp/schema.d.ts).

| Area | Endpoints |
|---|---|
| Auth | `/auth/authenticate`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| MFA | `/auth/mfa/setup`, `/auth/mfa/enable`, `/auth/mfa/verify`, `/auth/mfa/disable` |
| Tenancy | `/organizations`, `/users`, `/users/{id}/disable`, `/roles`, `/privileges` |
| Config | `/admin/parameters`, `/org/parameters` |
| Domain (DEL-01) | `/jobs`, `/jobs/{jobNumber}`, `/jobs/{jobNumber}/audit`, `/jobs/dashboard/kpis`, `/customers` |
| Domain (DEL-02, pending) | `/quotes`, `/webhooks/quotient` |

`JobsContext` talks to Spring Boot directly (JWT). Legacy Next.js `/api/jobs` / `/api/quotes` / `/api/analytics` handlers are retired stubs (410 / empty) so nothing asks for Supabase keys.

> **Supabase is removed** from the runtime dependency tree (`@supabase/supabase-js` uninstalled). Quote/inventory analytics stay empty until DEL-02 lands on the backend.

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

The role drives both landing route and **which nav shell** is used ([`components/AppNav.tsx`](./components/AppNav.tsx)):

| Role | Home | Navigation shell |
|---|---|---|
| `superadmin` | `/admin` | Dashboard · Organizations · Privileges · Parameters · Security |
| `orgadmin` | `/org` | Dashboard · Users · Roles · Integrations · Security |
| `orguser` | `/` | Dashboard · Jobs · Quotes · Analytics · Security *(items then privilege-filtered — see below)* |

**Org-user sidebar + field privilege gating (implemented):** within the org-user
shell, nav links and selected fields are driven by privileges from `/auth/me`.
Maps live in [`lib/frp/access.ts`](./lib/frp/access.ts); `AuthContext` exposes
`can(key)`, `canField(fieldKey)`, and `hasPrivilege(code)`.

| Kind | Mechanism | Effect |
|---|---|---|
| **MENU** (preferred) + **ACTION** fallback | `can(ACCESS_KEYS.*)` → `AppNav` | Hide Dashboard / Jobs / Quotes / Analytics |
| **ACTION** | `can(JOBS_CREATE)` etc. | Hide New Job / API-shaped buttons |
| **FIELD** | `canField(fieldKey)` / `<FieldGate>` | Hide per-field UI (e.g. quote `unit_price` ↔ `rate`) |

Nav prefers **MENU** codes (created in Super Admin, assigned on Org Admin roles). Matching
**ACTION** codes remain as OR fallbacks during rollout.

| Sidebar item | Access key | Privilege (any of) |
|---|---|---|
| Dashboard | `DASHBOARD_VIEW` | `MENU_DASHBOARD` / `MENU_JOBS` / `JOB_READ` |
| Jobs | `JOBS_VIEW` | `MENU_JOBS` **or** `JOB_READ` |
| Quotes | `QUOTES_VIEW` | `MENU_QUOTES` **or** `QUOTE_READ` |
| Analytics | `ANALYTICS_VIEW` | `MENU_ANALYTICS` / `MENU_DASHBOARD` **or** `JOB_READ` |

Create-job stays ACTION-only (`JOBS_CREATE` → `JOB_CREATE`). Org Admin Create Role lists
**ACTION + MENU + FIELD**. Platform-only codes are not shown to Org Admin.

**FIELD notes:** Super Admin sets `fieldKey` + `accessMode` on the catalog row; the FE maps
those keys in `FIELD_PRIVILEGE_MAP`. Until a user is granted any mapped FIELD code, field
ACL stays inactive (fail-open). After that, only granted fields show. Full write-up:
[`../BMS-backend/docs/PRIVILEGE_MODEL.md`](../BMS-backend/docs/PRIVILEGE_MODEL.md) §5.1–§5.2.

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
| `/settings/profile` | Profile, org/access details, and MFA enrolment |
| `/login` | Credential + MFA login |
| `/admin`, `/admin/organizations`, `/admin/privileges`, `/admin/parameters` | Platform super-admin |
| `/org`, `/org/users`, `/org/roles`, `/org/integrations` | Organization admin |

### API route handlers

Most domain traffic goes **directly to Spring Boot** from the browser (`lib/frp/api.ts`). Only thin Next.js helpers remain:

| Handler | Method | Notes |
|---|---|---|
| `/api/jobs/[jobNumber]/job-card-html` | GET | Print HTML proxy → Spring Boot `GET /jobs/{jobNumber}` (forwards Bearer) |
| `/api/webhooks/quotient` | GET, POST | Stub until DEL-02 webhook moves fully to Spring Boot |

Retired (no Supabase): `/api/jobs`, `/api/quotes`, `/api/analytics`, `/api/directors`, `/api/floor/rebalance` — return empty / 410.

---

## 6. Domain model

[`lib/types.ts`](./lib/types.ts) is the UI job shape. Mapping to/from Spring Boot DTOs is in [`lib/frp/job-mapper.ts`](./lib/frp/job-mapper.ts).

**Job status** — see [`lib/jobStatus.ts`](./lib/jobStatus.ts) (canonical PRD lifecycle + legacy aliases during migration).

**Resin types**: Isophthalic Polyester · Vinyl Ester · Phenolic. **Priority**: Normal · High · RUSH.

A `Job` carries optional `dbId` (Spring Boot PK), public `id` (`JOB-1001`, or `JOB-Q-<quote>` for Quotient-derived jobs), client/project, dates, hours, assignment, QA flags, and nested `printDetails: JobCardPrintDetails` (job-card fields mapped from `JobCardDTO` on the backend).

> **Database:** PostgreSQL is owned by **BMS-backend**. This frontend no longer ships a Supabase schema, client, or repositories. Domain tables (`jobs`, `customers`, …) live in the Spring Boot schema.

---

## 7. Quotient & SharePoint (DEL-02)

Quotes originate in [Quotient](https://www.quotientapp.com); accepted quotes become factory jobs. Job document folders live in SharePoint via Microsoft Graph.

**Direction:** ingestion and document APIs move to Spring Boot (`/webhooks/quotient`, `/jobs/{jobNumber}/sharepoint/*`). Until DEL-02 is live on the backend, the frontend keeps the env keys ready and org admins can still store the same names under **Org → Integrations** (`IntegrationParamCodes` on the backend).

### Env keys (frontend `.env` / deploy secrets)

| Variable | Purpose |
|---|---|
| `QUOTIENT_WEBHOOK_SECRET` | Shared secret Quotient sends as `Authorization: Bearer …` or `x-webhook-secret` |
| `QUOTIENT_API_KEY` | Outbound Quotient REST API key |
| `QUOTIENT_BASE_URL` | Quotient account / API base URL |
| `QUOTIENT_ENABLED` | Feature toggle (`true` / `false`) |
| `SHAREPOINT_ENABLED` | Feature toggle |
| `SHAREPOINT_SITE_URL` | SharePoint site URL |
| `SHAREPOINT_TENANT_ID` | Azure AD tenant ID |
| `SHAREPOINT_CLIENT_ID` | Azure app (client) ID |
| `SHAREPOINT_CLIENT_SECRET` | Azure app client secret (“API key”) |
| `SHAREPOINT_DRIVE_ID` | Document library / drive ID |

Never prefix secrets with `NEXT_PUBLIC_` — they must stay server-side only.

### Webhook behaviour (contract)

Quotient **permanently pauses** a webhook after 3 consecutive non-2xx responses or timeouts ([`docs/QUOTIENT_WEBHOOK.md`](./docs/QUOTIENT_WEBHOOK.md)):

1. Validate shared secret → acknowledge **200** quickly.
2. Persist raw payload and process asynchronously on Spring Boot (JobRunr / durable queue per contract) — not in the Next.js process.

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

Field-by-field mapping: [`docs/QUOTIENT_FIELD_MAPPING.md`](./docs/QUOTIENT_FIELD_MAPPING.md).

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

**`JobsContext`** ([`context/JobsContext.tsx`](./context/JobsContext.tsx)) — loads jobs from Spring Boot `GET /jobs` and exposes `jobs`, `staff`, `directors`, `hydrated`, `loading`, `error`, plus `refreshJobs()`, `getJobById()`, `createJobFromUi()`, `updateJob(job, audit?, auditDetail?)`, and `rebalanceFloor()` (stub until staff APIs exist). Writes go to `PATCH /jobs/{jobNumber}` with optional audit attribution.

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
| [`lib/mockData.ts`](./lib/mockData.ts), [`laborMock.ts`](./lib/laborMock.ts) | Demo fixtures |

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

Copy [`.env.example`](./.env.example) to `.env` (gitignored) or `.env.local`. Restart the Next.js dev server after changes.

### Required now (DEL-01)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FRP_API_BASE_URL` | Spring Boot API base URL (default `http://localhost:8080/api/v1`) |

### Required for DEL-02 (Quotient + SharePoint)

| Variable | Purpose |
|---|---|
| `QUOTIENT_WEBHOOK_SECRET` | Inbound webhook shared secret |
| `QUOTIENT_API_KEY` | Quotient REST API key |
| `QUOTIENT_BASE_URL` | Quotient account / API base URL |
| `QUOTIENT_ENABLED` | Enable Quotient integration |
| `SHAREPOINT_ENABLED` | Enable SharePoint integration |
| `SHAREPOINT_SITE_URL` | SharePoint site URL |
| `SHAREPOINT_TENANT_ID` | Azure AD tenant ID |
| `SHAREPOINT_CLIENT_ID` | Azure app client ID |
| `SHAREPOINT_CLIENT_SECRET` | Azure app client secret (SharePoint “API key”) |
| `SHAREPOINT_DRIVE_ID` | Drive / document library ID |

These SharePoint / Quotient names match backend `IntegrationParamCodes` and the Org → Integrations UI. Fill real values in `.env` before turning the toggles on; leave blanks while DEL-02 backend work is still in progress.

---

## 13. Scripts

| Command | Effect |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run dev:reset` | Kill ports 3000/3001, clear `.next`, restart |
| `npm run dev:clean` | Clear `.next`, then start dev |
| `npm run build` | Production build (runs `prebuild` guard first) |
| `npm run api:types` | Regenerate `lib/frp/schema.d.ts` from backend OpenAPI |
| `npm run api:mock` | Prism mock of the OpenAPI contract |

### Dev-server discipline

[`.cursor/rules/next-dev.mdc`](./.cursor/rules/next-dev.mdc) encodes a hard-won rule: **never run `npm run build` while `npm run dev` is running.** They share `.next`, and doing so corrupts CSS (404 on `layout.css`, unstyled page). Run one dev server only; recover with `npm run dev:reset`. [`scripts/prebuild-guard.mjs`](./scripts/prebuild-guard.mjs) enforces this by refusing to build when ports 3000/3001 are listening.

---

## 14. Known gaps

- **`prebuild-guard.mjs` is Windows-only.** Port detection shells out to `netstat -ano | findstr ...` and checks for `LISTENING`. On macOS/Linux that command fails, the `catch` returns `false`, and the guard silently passes — the build proceeds against a live dev server, which is exactly the corruption it exists to prevent. It needs an `lsof -i :3000` (or `process.platform`) branch.
- **`README.md` is stale.** It still describes a three-feature prototype and omits Supabase, authentication, Quotient, and the entire admin surface.
- **Auth tokens live in `localStorage`**, which is XSS-readable. Acceptable for the current stage; worth revisiting against httpOnly cookies before production hardening.
- **Git history is a single commit**, so there is no incremental record of how the app evolved.
