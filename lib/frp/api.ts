import {
  FrpApiError,
  type ApplicationParameterDTO,
  type AuthenticationResponse,
  type CreateOrganizationRequest,
  type CreateUserRequest,
  type MfaSetupResponse,
  type OrganizationDTO,
  type OrganizationProvisionResponse,
  type PageResponse,
  type PrivilegeDTO,
  type RoleDTO,
  type UpdateUserRequest,
  type UserDTO,
} from "@/lib/frp/types";
import type {
  FrpDrawingStageDTO,
  FrpDrawingStage,
  FrpJobAuditHistoryDTO,
  FrpJobCardPayload,
  FrpJobContactDetailsDTO,
  FrpJobCountsDTO,
  FrpJobDTO,
  FrpJobSchedulingLogisticsDTO,
  FrpJobStageDTO,
  FrpJobStageUpdateRequest,
  FrpJobSummaryDTO,
} from "@/lib/frp/job-mapper";
import {
  STATUS_TARGET_STAGE,
  type BackendJobStatus,
} from "@/lib/frp/job-status";

const DEFAULT_BASE = "http://localhost:8080/api/v1";

export const FRP_ACCESS_TOKEN_KEY = "frp_access_token";
export const FRP_REFRESH_TOKEN_KEY = "frp_refresh_token";

export function getFrpApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_FRP_API_BASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_BASE).replace(/\/$/, "");
}

type TokenGetter = () => string | null;
type SessionTokens = { token: string; refreshToken: string };
type SessionUpdater = (tokens: SessionTokens | null) => void;

let getAccessToken: TokenGetter = () => null;
let sessionUpdater: SessionUpdater | null = null;
let refreshInFlight: Promise<SessionTokens> | null = null;

export function setFrpAccessTokenGetter(getter: TokenGetter) {
  getAccessToken = getter;
}

export function setFrpSessionUpdater(updater: SessionUpdater | null) {
  sessionUpdater = updater;
}

function readStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FRP_REFRESH_TOKEN_KEY);
}

function persistSession(token: string, refreshToken: string) {
  localStorage.setItem(FRP_ACCESS_TOKEN_KEY, token);
  localStorage.setItem(FRP_REFRESH_TOKEN_KEY, refreshToken);
  sessionUpdater?.({ token, refreshToken });
}

function clearStoredSession() {
  localStorage.removeItem(FRP_ACCESS_TOKEN_KEY);
  localStorage.removeItem(FRP_REFRESH_TOKEN_KEY);
  sessionUpdater?.(null);
}

function shouldAttemptRefresh(path: string, useAuth: boolean): boolean {
  if (!useAuth) return false;
  if (path.startsWith("/auth/refresh")) return false;
  if (path.startsWith("/auth/authenticate")) return false;
  if (path.startsWith("/auth/logout")) return false;
  if (path.startsWith("/auth/mfa/")) return false;
  return true;
}

async function parseError(res: Response): Promise<FrpApiError> {
  let body: unknown;
  let message = res.statusText || `Request failed (${res.status})`;
  try {
    body = await res.json();
    if (body && typeof body === "object") {
      const o = body as Record<string, unknown>;
      if (typeof o.error === "string" && o.error) message = o.error;
      else if (
        typeof o.businessErrorDescription === "string" &&
        o.businessErrorDescription
      ) {
        message = o.businessErrorDescription;
      } else if (typeof o.message === "string" && o.message) {
        message = o.message;
      }

      // `ExceptionResponse.errors` is a field → message map. It was being
      // dropped, so a rejected save showed only "Validation failed" with no
      // indication of which field the backend objected to.
      const fields = o.errors;
      if (fields && typeof fields === "object" && !Array.isArray(fields)) {
        const detail = Object.entries(fields as Record<string, unknown>)
          .map(([field, msg]) => `${field}: ${String(msg)}`)
          .join("; ");
        if (detail) message = `${message} — ${detail}`;
      } else if (
        Array.isArray(o.validationErrors) &&
        o.validationErrors.length
      ) {
        message = `${message} — ${o.validationErrors.join("; ")}`;
      }
    }
  } catch {
    /* ignore */
  }
  return new FrpApiError(res.status, message, body);
}

async function performTokenRefresh(
  refreshToken: string
): Promise<SessionTokens> {
  const res = await fetch(`${getFrpApiBase()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearStoredSession();
    throw await parseError(res);
  }
  const data = (await res.json()) as AuthenticationResponse;
  if (!data.token || !data.refreshToken) {
    clearStoredSession();
    throw new FrpApiError(401, "Invalid refresh response");
  }
  persistSession(data.token, data.refreshToken);
  return { token: data.token, refreshToken: data.refreshToken };
}

/** Single-flight refresh using the stored refresh token. */
export async function refreshSession(): Promise<SessionTokens> {
  if (refreshInFlight) return refreshInFlight;
  const rt = readStoredRefreshToken();
  if (!rt) {
    clearStoredSession();
    throw new FrpApiError(401, "No refresh token");
  }
  refreshInFlight = performTokenRefresh(rt).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function refreshTokens(
  refreshToken: string
): Promise<AuthenticationResponse> {
  const session = await performTokenRefresh(refreshToken);
  return {
    token: session.token,
    refreshToken: session.refreshToken,
  };
}

async function frpFetch<T>(
  path: string,
  init: RequestInit = {},
  opts?: { auth?: boolean; retried?: boolean }
): Promise<T> {
  const useAuth = opts?.auth !== false;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (useAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${getFrpApiBase()}${path}`, {
    ...init,
    headers,
  });

  if (
    !res.ok &&
    res.status === 401 &&
    !opts?.retried &&
    shouldAttemptRefresh(path, useAuth) &&
    readStoredRefreshToken()
  ) {
    try {
      await refreshSession();
      return frpFetch<T>(path, init, { ...opts, retried: true });
    } catch {
      throw await parseError(res);
    }
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function authenticate(
  email: string,
  password: string
): Promise<AuthenticationResponse> {
  return frpFetch<AuthenticationResponse>(
    "/auth/authenticate",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false }
  );
}

export async function verifyMfa(
  mfaToken: string,
  code: string
): Promise<AuthenticationResponse> {
  return frpFetch<AuthenticationResponse>(
    "/auth/mfa/verify",
    {
      method: "POST",
      body: JSON.stringify({ mfaToken, code }),
    },
    { auth: false }
  );
}

export async function setupMfa(): Promise<MfaSetupResponse> {
  return frpFetch<MfaSetupResponse>("/auth/mfa/setup", { method: "POST" });
}

export async function enableMfa(code: string): Promise<void> {
  await frpFetch("/auth/mfa/enable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function disableMfa(
  password: string,
  code: string
): Promise<void> {
  await frpFetch("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify({ password, code }),
  });
}

export async function listParameters(
  organizationId?: number | null
): Promise<ApplicationParameterDTO[]> {
  const q = organizationId != null ? `?organizationId=${organizationId}` : "";
  return frpFetch<ApplicationParameterDTO[]>(`/admin/parameters${q}`);
}

export async function upsertParameter(
  body: ApplicationParameterDTO
): Promise<ApplicationParameterDTO> {
  const payload: Record<string, unknown> = {
    paramName: body.paramName,
    paramValue: body.paramValue ?? "",
    paramType: body.paramType ?? "String",
  };
  if (body.id != null) payload.id = body.id;
  if (body.description) payload.description = body.description;
  if (body.organizationId != null) payload.organizationId = body.organizationId;
  if (body.orgEditable != null) payload.orgEditable = body.orgEditable;
  return frpFetch<ApplicationParameterDTO>("/admin/parameters", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteParameter(id: number): Promise<void> {
  await frpFetch(`/admin/parameters/${id}`, { method: "DELETE" });
}

export async function listOrgParameters(): Promise<ApplicationParameterDTO[]> {
  return frpFetch<ApplicationParameterDTO[]>("/org/parameters");
}

export async function upsertOrgParameter(
  body: ApplicationParameterDTO
): Promise<ApplicationParameterDTO> {
  const payload: Record<string, unknown> = {
    paramName: body.paramName,
    paramValue: body.paramValue ?? "",
    paramType: body.paramType ?? "String",
  };
  if (body.id != null) payload.id = body.id;
  return frpFetch<ApplicationParameterDTO>("/org/parameters", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await frpFetch(
    "/auth/logout",
    {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    },
    { auth: false }
  );
}

export async function fetchMe(): Promise<UserDTO> {
  return frpFetch<UserDTO>("/auth/me");
}

/** Profile fields a user may edit about themselves. */
export interface MyProfileUpdate {
  displayName: string;
  mobileNumber?: string;
}

/**
 * Update the signed-in user's own profile.
 *
 * The backend has no self-service endpoint yet — `/auth/me` is GET-only and
 * `PUT /users` is gated behind USER_UPDATE, so it only works for users who
 * already hold that privilege (org admins, super admins). Callers should gate
 * the UI on {@link canEditOwnProfile}.
 *
 * When the backend adds `PATCH /auth/me`, replace this body with a single
 * frpFetch call and drop the privilege gate — no component changes needed.
 */
export async function updateMyProfile(
  me: UserDTO,
  patch: MyProfileUpdate
): Promise<UserDTO> {
  if (me.id == null) {
    throw new FrpApiError(400, "Cannot update profile: missing user id");
  }
  return updateUser({
    id: me.id,
    displayName: patch.displayName,
    mobileNumber: patch.mobileNumber,
    enabled: me.enabled ?? true,
    // Preserved as-is — self-service editing must never change own roles.
    roleIds: me.roleIds ?? [],
  });
}

/** Whether the current user can persist their own profile edits today. */
export function canEditOwnProfile(me: UserDTO | null): boolean {
  return Boolean(
    me?.id != null && me?.rolesPrivileges?.includes("USER_UPDATE")
  );
}

export async function listOrganizations(
  page = 0,
  size = 20
): Promise<PageResponse<OrganizationDTO>> {
  return frpFetch<PageResponse<OrganizationDTO>>(
    `/organizations?page=${page}&size=${size}`
  );
}

export async function createOrganization(
  body: CreateOrganizationRequest
): Promise<OrganizationProvisionResponse> {
  return frpFetch<OrganizationProvisionResponse>("/organizations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateOrganization(body: OrganizationDTO): Promise<void> {
  await frpFetch("/organizations", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function listRoles(
  page = 0,
  size = 20
): Promise<PageResponse<RoleDTO>> {
  return frpFetch<PageResponse<RoleDTO>>(`/roles?page=${page}&size=${size}`);
}

export async function listUsers(
  page = 0,
  size = 20
): Promise<PageResponse<UserDTO>> {
  return frpFetch<PageResponse<UserDTO>>(`/users?page=${page}&size=${size}`);
}

export async function createUser(body: CreateUserRequest): Promise<UserDTO> {
  return frpFetch<UserDTO>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateUser(body: UpdateUserRequest): Promise<UserDTO> {
  return frpFetch<UserDTO>("/users", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function disableUser(id: number): Promise<UserDTO> {
  return frpFetch<UserDTO>(`/users/${id}/disable`, { method: "PUT" });
}

export async function createRole(body: RoleDTO): Promise<void> {
  await frpFetch("/roles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRole(body: RoleDTO): Promise<void> {
  await frpFetch("/roles", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function listPrivileges(params?: {
  type?: string;
  active?: boolean;
}): Promise<PrivilegeDTO[]> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.active != null) q.set("active", String(params.active));
  const qs = q.toString();
  return frpFetch<PrivilegeDTO[]>(`/privileges${qs ? `?${qs}` : ""}`);
}

export async function createPrivilege(
  body: PrivilegeDTO
): Promise<PrivilegeDTO> {
  return frpFetch<PrivilegeDTO>("/privileges", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePrivilege(
  id: number,
  body: PrivilegeDTO
): Promise<PrivilegeDTO> {
  return frpFetch<PrivilegeDTO>(`/privileges/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ jobs */

/** Sort options `GET /jobs` accepts. Bound to the `JobSort` enum — a
 *  Spring-style `field,dir` string is a 400, not a fallback. */
export type FrpJobSort = "DUE_DATE" | "RECENT" | "OLDEST";

export interface ListJobsParams {
  search?: string;
  sort?: FrpJobSort;
  /** Backend `JobStatus` enum name, not a display label. */
  status?: string;
  /** Backend `JobPriority` enum name. */
  priority?: string;
  assignedTo?: number;
  /** ISO date (`yyyy-MM-dd`). */
  dueBefore?: string;
}

/**
 * `GET /jobs` → `PageResponse<JobSummaryDTO>`.
 *
 * Size is capped at 200: `bms-api.yaml` sets `maximum: 200`, and the previous
 * `size=500` made the Prism mock unusable for the dashboard.
 */
export async function listJobs(
  page = 0,
  size = 200,
  params?: ListJobsParams
): Promise<PageResponse<FrpJobSummaryDTO>> {
  const q = new URLSearchParams({
    page: String(page),
    size: String(Math.min(size, 200)),
  });
  if (params?.search) q.set("search", params.search);
  if (params?.sort) q.set("sort", params.sort);
  if (params?.status) q.set("status", params.status);
  if (params?.priority) q.set("priority", params.priority);
  if (params?.assignedTo != null)
    q.set("assignedTo", String(params.assignedTo));
  if (params?.dueBefore) q.set("dueBefore", params.dueBefore);
  return frpFetch<PageResponse<FrpJobSummaryDTO>>(`/jobs?${q}`);
}

/** `GET /jobs/counts` — org-scoped aggregates for the dashboard tiles. */
export async function getJobCounts(): Promise<FrpJobCountsDTO> {
  return frpFetch<FrpJobCountsDTO>("/jobs/counts");
}

/** `GET /jobs/{id}` — full record including `jobCard`. */
export async function getJob(dbId: string | number): Promise<FrpJobDTO> {
  return frpFetch<FrpJobDTO>(`/jobs/${encodeURIComponent(String(dbId))}`);
}

/** `POST /jobs` — seeds the ten stages and an empty job card. */
export async function createJob(body: FrpJobDTO): Promise<FrpJobDTO> {
  return frpFetch<FrpJobDTO>("/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PUT /jobs` — id travels in the body. Last-write-wins; no version token. */
export async function updateJobApi(body: FrpJobDTO): Promise<FrpJobDTO> {
  return frpFetch<FrpJobDTO>("/jobs", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** `PUT /jobs/{id}/job-card` — the card is replaced as a unit. */
export async function saveJobCard(
  dbId: string | number,
  jobCard: FrpJobCardPayload
): Promise<FrpJobDTO> {
  return frpFetch<FrpJobDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/job-card`,
    { method: "PUT", body: JSON.stringify(jobCard) }
  );
}

/** `PUT /jobs/{id}/contact-details` — the customer panel, saved alone. */
export async function saveContactDetails(
  dbId: string | number,
  contactDetails: FrpJobContactDetailsDTO
): Promise<FrpJobDTO> {
  return frpFetch<FrpJobDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/contact-details`,
    { method: "PUT", body: JSON.stringify(contactDetails) }
  );
}

/** `PUT /jobs/{id}/scheduling-logistics` — the logistics panel, saved alone. */
export async function saveSchedulingLogistics(
  dbId: string | number,
  schedulingLogistics: FrpJobSchedulingLogisticsDTO
): Promise<FrpJobDTO> {
  return frpFetch<FrpJobDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/scheduling-logistics`,
    { method: "PUT", body: JSON.stringify(schedulingLogistics) }
  );
}

/**
 * `GET /jobs/{id}/job-card` — fetches the card and records a
 * `JOB_CARD_DOWNLOADED` audit row against the caller. Call this when the user
 * downloads/prints the card so the pull is tracked; the returned DTO is the
 * same shape as {@link getJob}'s but carries the card without the detail joins.
 */
export async function downloadJobCard(
  dbId: string | number
): Promise<FrpJobDTO> {
  return frpFetch<FrpJobDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/job-card`
  );
}

/** `DELETE /jobs/{id}` — soft cancel, sets `stageStatus = CANCELLED`. */
export async function cancelJob(dbId: string | number): Promise<void> {
  await frpFetch(`/jobs/${encodeURIComponent(String(dbId))}`, {
    method: "DELETE",
  });
}

export async function listJobAudit(
  dbId: string | number,
  page = 0,
  size = 50
): Promise<PageResponse<FrpJobAuditHistoryDTO>> {
  return frpFetch<PageResponse<FrpJobAuditHistoryDTO>>(
    `/jobs/${encodeURIComponent(String(dbId))}/audit?page=${page}&size=${size}`
  );
}

/* ------------------------------------------------------- drawing stages */

/** `GET /jobs/{id}/drawing-stages` — all five, ticked or not. */
export async function listDrawingStages(
  dbId: string | number
): Promise<FrpDrawingStageDTO[]> {
  return frpFetch<FrpDrawingStageDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/drawing-stages`
  );
}

/**
 * Tick or untick one stage.
 *
 * Returns the whole checklist, so the caller replaces its state wholesale
 * rather than patching one entry and risking a stale view of the other four.
 */
export async function setDrawingStage(
  dbId: string | number,
  stage: FrpDrawingStage,
  completed: boolean,
  remarks?: string
): Promise<FrpDrawingStageDTO[]> {
  const q = new URLSearchParams({ completed: String(completed) });
  if (remarks) q.set("remarks", remarks);
  return frpFetch<FrpDrawingStageDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/drawing-stages/${stage}?${q}`,
    { method: "PUT" }
  );
}

/* ---------------------------------------------------------------- stages */

/** `GET /jobs/{id}/stages` — milestones with their operations nested. */
export async function listJobStages(
  dbId: string | number
): Promise<FrpJobStageDTO[]> {
  return frpFetch<FrpJobStageDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/stages`
  );
}

/** `PUT /jobs/{id}/stages/{stageId}` — recomputes `job.stageStatus`. */
export async function updateJobStage(
  dbId: string | number,
  stageId: number,
  body: FrpJobStageUpdateRequest
): Promise<FrpJobStageDTO> {
  return frpFetch<FrpJobStageDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/stages/${stageId}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

/** `POST /jobs/{id}/stages/{stageId}/scan` — idempotent shop-floor scan. */
export async function scanJobStage(
  dbId: string | number,
  stageId: number
): Promise<FrpJobStageDTO> {
  return frpFetch<FrpJobStageDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/stages/${stageId}/scan`,
    { method: "POST" }
  );
}

/**
 * Move a job to a target status.
 *
 * `stageStatus` is `READ_ONLY` on `JobDTO` and recomputed by the stage service,
 * so a status change is a stage change. `CANCELLED` is the exception — it has
 * its own endpoint. Throws when the target is not reachable, rather than
 * appearing to succeed.
 */
export async function advanceJobStatus(
  dbId: string | number,
  target: BackendJobStatus
): Promise<void> {
  if (target === "CANCELLED") {
    await cancelJob(dbId);
    return;
  }
  const plan = STATUS_TARGET_STAGE[target];
  if (!plan) {
    throw new FrpApiError(400, `No stage transition maps to ${target}.`);
  }
  const stages = await listJobStages(dbId);
  const match = stages.find((s) => s.stageKey === plan.stageKey);
  if (!match?.id) {
    throw new FrpApiError(
      404,
      `Job has no "${plan.stageKey}" stage, so it cannot move to ${target}.`
    );
  }
  await updateJobStage(dbId, match.id, { status: plan.status });
}

export async function listQuotes(
  page = 0,
  size = 100
): Promise<PageResponse<Record<string, unknown>>> {
  return frpFetch<PageResponse<Record<string, unknown>>>(
    `/quotes?page=${page}&size=${size}`
  );
}

/** Null when no quote exists with that number in the caller's organization. */
export async function getQuote(
  quoteNumber: string
): Promise<Record<string, unknown> | null> {
  try {
    return await frpFetch<Record<string, unknown>>(
      `/quotes/${encodeURIComponent(quoteNumber)}`
    );
  } catch (err) {
    if (err instanceof FrpApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/** One ingest event by id, with full detail (incl. raw payload).
 *  Null when no event exists with that id. */
export async function getQuoteEvent(
  eventId: number | string
): Promise<Record<string, unknown> | null> {
  try {
    return await frpFetch<Record<string, unknown>>(
      `/quotes/events/${encodeURIComponent(String(eventId))}`
    );
  } catch (err) {
    if (err instanceof FrpApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}
