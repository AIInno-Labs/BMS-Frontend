import {
  FrpApiError,
  type ApplicationParameterDTO,
  type AuthenticationResponse,
  type CreateOrganizationRequest,
  type CreateUserRequest,
  type IntegrationApiKeyDTO,
  type MfaSetupResponse,
  type QuotientIntegrationDTO,
  type OrganizationDTO,
  type OrganizationProvisionResponse,
  type PageResponse,
  type PrivilegeDTO,
  type RoleDTO,
  type UpdateUserRequest,
  type UserDTO,
  type GroupChatDTO,
  type NotificationDTO,
  type NotificationSummaryDTO,
} from "@/lib/frp/types";
import type {
  FrpDocumentDownloadDTO,
  FrpDocumentSort,
  FrpDocumentType,
  FrpJobAuditHistoryDTO,
  FrpJobCardPayload,
  FrpJobContactDetailsDTO,
  FrpJobCountsDTO,
  FrpJobDocumentDTO,
  FrpJobDocumentUpdateRequest,
  FrpJobDTO,
  FrpJobInventoryDTO,
  FrpMasterInventoryDTO,
  FrpJobPaymentDTO,
  FrpJobPaymentUpdateRequest,
  FrpJobProjectRequirementDTO,
  FrpJobSchedulingLogisticsDTO,
  FrpJobStageDTO,
  FrpJobStageUpdateRequest,
  FrpJobSummaryDTO,
  FrpManualPoRequest,
  FrpPoComparisonDTO,
} from "@/lib/frp/job-mapper";
import type { ProjectRequirementKind } from "@/lib/frp/project-requirements";
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

/** Prefer the AuthProvider getter; always fall back to localStorage so early
 *  page effects (e.g. RolesAdminPage) never call the API without a Bearer
 *  token while the provider is still mounting. */
let getAccessToken: TokenGetter = () =>
  typeof window !== "undefined"
    ? localStorage.getItem(FRP_ACCESS_TOKEN_KEY)
    : null;
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
  // FormData bodies must keep the browser-generated multipart boundary —
  // setting Content-Type ourselves would drop it and break the upload.
  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (useAuth) {
    const token =
      getAccessToken() ||
      (typeof window !== "undefined"
        ? localStorage.getItem(FRP_ACCESS_TOKEN_KEY)
        : null);
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

// ---------------------------------------------------------------- Quotient

export async function getQuotientIntegration(): Promise<QuotientIntegrationDTO> {
  return frpFetch<QuotientIntegrationDTO>("/integrations/quotient");
}

export async function updateQuotientIntegration(
  body: Partial<QuotientIntegrationDTO>
): Promise<QuotientIntegrationDTO> {
  return frpFetch<QuotientIntegrationDTO>("/integrations/quotient", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * Issue a new webhook token; returns the token, URL and expiry. Pass an
 * optional ISO expiry to select the token's lifetime.
 */
export async function regenerateQuotientWebhookToken(
  expiresAt?: string | null
): Promise<QuotientIntegrationDTO> {
  return frpFetch<QuotientIntegrationDTO>("/integrations/quotient/webhook-token", {
    method: "POST",
    body: JSON.stringify({ webhookExpiresAt: expiresAt ?? null }),
  });
}

/** Revoke a webhook token by id (e.g. a leaked one). */
export async function revokeQuotientWebhookToken(
  id: number
): Promise<QuotientIntegrationDTO> {
  return frpFetch<QuotientIntegrationDTO>(
    `/integrations/quotient/webhook-token/${id}`,
    { method: "DELETE" }
  );
}

// ----------------------------------------------- integration API keys

export async function listIntegrationApiKeys(
  provider: string
): Promise<IntegrationApiKeyDTO[]> {
  return frpFetch<IntegrationApiKeyDTO[]>(`/integrations/${provider}/api-key`);
}

export async function issueIntegrationApiKey(
  provider: string,
  body: { apiKey: string; expiresAt?: string | null }
): Promise<IntegrationApiKeyDTO> {
  return frpFetch<IntegrationApiKeyDTO>(`/integrations/${provider}/api-key`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function revokeIntegrationApiKey(
  provider: string,
  id: number
): Promise<IntegrationApiKeyDTO> {
  return frpFetch<IntegrationApiKeyDTO>(`/integrations/${provider}/api-key/${id}`, {
    method: "DELETE",
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

export type FrpQuoteEventCountDTO = {
  eventType: string;
  label: string;
  count: number;
  known: boolean;
};

export type FrpQuoteEventCountsSummaryDTO = {
  total: number;
  byType: FrpQuoteEventCountDTO[];
};

/** `GET /quotes/event-counts` — org-scoped quotient event totals by type. */
export async function getQuoteEventCounts(): Promise<FrpQuoteEventCountsSummaryDTO> {
  return frpFetch<FrpQuoteEventCountsSummaryDTO>("/quotes/event-counts");
}

export type FrpJobCompanyCountDTO = {
  rank: number;
  companyName: string;
  jobCount: number;
};

/** `GET /jobs/top-clients` — ranked clients by job count. */
export async function getTopClients(limit = 5): Promise<FrpJobCompanyCountDTO[]> {
  return frpFetch<FrpJobCompanyCountDTO[]>(`/jobs/top-clients?limit=${limit}`);
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
 * `PUT /jobs/{id}/payment` — mark received (or not) and/or set estimated due date.
 * Null fields are left unchanged. Prefers the FINAL payment when several exist.
 */
export async function updateJobPayment(
  dbId: string | number,
  body: FrpJobPaymentUpdateRequest
): Promise<FrpJobPaymentDTO> {
  return frpFetch<FrpJobPaymentDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/payment`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

/**
 * `PUT /jobs/{id}/requirements/{kind}` — decide one project requirement;
 * returns all three rows (same pattern as payment kind on `job_payment`).
 */
export async function setJobRequirement(
  dbId: string | number,
  kind: ProjectRequirementKind,
  required: boolean,
  remarks?: string
): Promise<FrpJobProjectRequirementDTO[]> {
  const params = new URLSearchParams({ required: String(required) });
  if (remarks?.trim()) {
    params.set("remarks", remarks.trim());
  }
  return frpFetch<FrpJobProjectRequirementDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/requirements/${encodeURIComponent(kind)}?${params}`,
    { method: "PUT" }
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

/* -------------------------------------------------------------- documents */

/** `GET /jobs/{id}/documents` — soft-deleted excluded. */
export async function listJobDocuments(
  dbId: string | number,
  params?: {
    type?: FrpDocumentType;
    editedBy?: number;
    sort?: FrpDocumentSort;
  }
): Promise<FrpJobDocumentDTO[]> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.editedBy != null) q.set("editedBy", String(params.editedBy));
  if (params?.sort) q.set("sort", params.sort);
  const qs = q.toString();
  return frpFetch<FrpJobDocumentDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/documents${qs ? `?${qs}` : ""}`
  );
}

/** `POST /jobs/{id}/documents` — multipart upload, one file per call. */
export async function uploadJobDocument(
  dbId: string | number,
  params: {
    jobStageId: number;
    file: File;
    documentName?: string;
    remarks?: string;
  }
): Promise<FrpJobDocumentDTO> {
  const form = new FormData();
  form.set("jobStageId", String(params.jobStageId));
  form.set("file", params.file);
  if (params.documentName) form.set("documentName", params.documentName);
  if (params.remarks) form.set("remarks", params.remarks);

  return frpFetch<FrpJobDocumentDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/documents`,
    { method: "POST", body: form }
  );
}

/**
 * `POST /jobs/{jobId}/documents/po` — hand-keyed purchase order (JSON, no file).
 * No OCR / LLM; the server writes `documentData` in the extractor's keys with
 * `extractionStatus=SKIPPED` so compare treats it like an extracted PO.
 */
export async function createManualPoDocument(
  dbId: string | number,
  body: FrpManualPoRequest
): Promise<FrpJobDocumentDTO> {
  return frpFetch<FrpJobDocumentDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/documents/po`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

/**
 * `GET /jobs/{jobId}/documents/{documentId}/compare` — PRODUCTION docs only.
 * Compares extracted / edited PO data against the job quote.
 */
export async function compareJobDocument(
  dbId: string | number,
  documentId: number
): Promise<FrpPoComparisonDTO> {
  return frpFetch<FrpPoComparisonDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/documents/${documentId}/compare`
  );
}

/** `PUT /documents/{id}` — partial update (status, remarks, editedDocumentData, …). */
export async function updateJobDocument(
  id: number,
  body: FrpJobDocumentUpdateRequest
): Promise<FrpJobDocumentDTO> {
  return frpFetch<FrpJobDocumentDTO>(`/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** `GET /documents/{id}/download` — short-lived signed SharePoint URL. */
export async function downloadJobDocument(
  id: number
): Promise<FrpDocumentDownloadDTO> {
  return frpFetch<FrpDocumentDownloadDTO>(`/documents/${id}/download`);
}

/** `DELETE /documents/{id}`. */
export async function deleteJobDocument(id: number): Promise<void> {
  await frpFetch<void>(`/documents/${id}`, { method: "DELETE" });
}

/**
 * `GET /master-inventory` — the org's product catalogue. Job users with
 * `MASTER_INVENTORY_READ` (granted alongside `INVENTORY_READ`) can list it
 * so the Add Inventory picker has something to choose from.
 */
export async function listMasterInventory(): Promise<FrpMasterInventoryDTO[]> {
  return frpFetch<FrpMasterInventoryDTO[]>("/master-inventory");
}

/** `POST /master-inventory` — add one or more catalogue items (org admin). */
export async function addMasterInventory(
  body: FrpMasterInventoryDTO[]
): Promise<FrpMasterInventoryDTO[]> {
  return frpFetch<FrpMasterInventoryDTO[]>("/master-inventory", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PUT /master-inventory` — update catalogue items (org admin). Pass one row as `[item]`. */
export async function updateMasterInventory(
  body: FrpMasterInventoryDTO[]
): Promise<FrpMasterInventoryDTO[]> {
  return frpFetch<FrpMasterInventoryDTO[]>("/master-inventory", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** `DELETE /master-inventory` — remove catalogue items. Pass one id as `[id]`. */
export async function deleteMasterInventory(ids: number[]): Promise<void> {
  await frpFetch<void>("/master-inventory", {
    method: "DELETE",
    body: JSON.stringify(ids),
  });
}

/**
 * `GET /jobs/{id}/job-inventory` — catalogue items this job consumes.
 * Also returned inline on `GET /jobs/{id}` (`Job.inventory`); call this only
 * when the list needs to be refreshed on its own.
 */
export async function listJobInventory(
  dbId: string | number
): Promise<FrpJobInventoryDTO[]> {
  return frpFetch<FrpJobInventoryDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/job-inventory`
  );
}

/** `PUT /jobs/{id}/job-inventory` — replace the job's lines in one call. */
export async function replaceJobInventory(
  dbId: string | number,
  body: Array<{ masterInventoryId: number; quantity: number }>
): Promise<FrpJobInventoryDTO[]> {
  return frpFetch<FrpJobInventoryDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/job-inventory`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

/** `POST /jobs/{id}/job-inventory` — attach catalogue items (upsert by item). */
export async function addJobInventory(
  dbId: string | number,
  body: Array<{ masterInventoryId: number; quantity: number }>
): Promise<FrpJobInventoryDTO[]> {
  return frpFetch<FrpJobInventoryDTO[]>(
    `/jobs/${encodeURIComponent(String(dbId))}/job-inventory`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

/** `DELETE /jobs/{id}/job-inventory` — remove lines by id. */
export async function deleteJobInventoryLines(
  dbId: string | number,
  ids: number[]
): Promise<void> {
  await frpFetch<void>(
    `/jobs/${encodeURIComponent(String(dbId))}/job-inventory`,
    { method: "DELETE", body: JSON.stringify(ids) }
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

/** Backend `QuoteStatus` enum — mirrors `Enum/QuoteStatus.java`. */
export type FrpQuoteStatus =
  | "AWAITING_ACCEPTANCE"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "COMPLETED";

export async function listQuotes(
  page = 0,
  size = 100,
  filters?: {
    status?: FrpQuoteStatus | FrpQuoteStatus[];
    company?: string | string[];
  }
): Promise<PageResponse<Record<string, unknown>>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  const statuses = filters?.status
    ? Array.isArray(filters.status)
      ? filters.status
      : [filters.status]
    : [];
  for (const s of statuses) {
    if (s) params.append("status", s);
  }
  const companies = filters?.company
    ? Array.isArray(filters.company)
      ? filters.company
      : [filters.company]
    : [];
  for (const c of companies) {
    if (c?.trim()) params.append("company", c.trim());
  }
  return frpFetch<PageResponse<Record<string, unknown>>>(`/quotes?${params}`);
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

/* --------------------------------------------------------------- job chat */

/**
 * `GET /jobs/{id}/messages` — the thread, newest first.
 *
 * `since` is what makes polling cheap: pass the timestamp of the newest
 * message already held and the server returns only what arrived after it.
 * Merge the result by `id` rather than appending — clock skew between app
 * servers could otherwise duplicate or drop a message.
 */
export async function listJobMessages(
  dbId: string | number,
  opts?: { since?: string | null; page?: number; size?: number }
): Promise<PageResponse<GroupChatDTO>> {
  const params = new URLSearchParams({
    page: String(opts?.page ?? 0),
    size: String(opts?.size ?? 20),
  });
  if (opts?.since) params.set("since", opts.since);
  return frpFetch<PageResponse<GroupChatDTO>>(
    `/jobs/${encodeURIComponent(String(dbId))}/messages?${params.toString()}`
  );
}

/**
 * `POST /jobs/{id}/messages`.
 *
 * `clientMsgId` is optional to the server but should always be sent: the
 * unique index on it turns a retry after a dropped connection into a no-op
 * that returns the original message, instead of posting twice.
 *
 * `@all` in the body is detected server-side and notifies every other
 * MESSAGE_READ holder in the organization.
 */
export async function postJobMessage(
  dbId: string | number,
  body: string,
  opts?: { clientMsgId?: string; tag?: GroupChatDTO["tag"] }
): Promise<GroupChatDTO> {
  return frpFetch<GroupChatDTO>(
    `/jobs/${encodeURIComponent(String(dbId))}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        body,
        clientMsgId: opts?.clientMsgId ?? null,
        tag: opts?.tag ?? null,
      }),
    }
  );
}

/**
 * `POST /jobs/{id}/messages/read` — advance this user's watermark.
 *
 * Also clears their notifications for the job up to that message, so reading
 * the thread puts the red dot out without a second trip to the panel.
 */
export async function markThreadRead(
  dbId: string | number,
  lastReadMessageId: number
): Promise<void> {
  await frpFetch<void>(
    `/jobs/${encodeURIComponent(String(dbId))}/messages/read`,
    { method: "POST", body: JSON.stringify({ lastReadMessageId }) }
  );
}

/* ----------------------------------------------------------- notifications */

/**
 * `GET /notifications/summary` — the badge poll.
 *
 * Every signed-in user calls this every 45 seconds, so it returns two numbers
 * and nothing else. The caller is always the current user; there is no way to
 * request someone else's inbox.
 */
export async function getNotificationSummary(): Promise<NotificationSummaryDTO> {
  return frpFetch<NotificationSummaryDTO>("/notifications/summary");
}

/** `GET /notifications` — the panel. Read and unread together by default. */
export async function listNotifications(opts?: {
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}): Promise<PageResponse<NotificationDTO>> {
  const params = new URLSearchParams({
    unreadOnly: String(opts?.unreadOnly ?? false),
    page: String(opts?.page ?? 0),
    size: String(opts?.size ?? 20),
  });
  return frpFetch<PageResponse<NotificationDTO>>(
    `/notifications?${params.toString()}`
  );
}

/**
 * `POST /notifications/read` — mark specific rows, or everything up to an id.
 *
 * Only the caller's own notifications are affected: passing an id belonging to
 * a colleague updates zero rows server-side.
 */
export async function markNotificationsRead(
  target: { ids: number[] } | { upToId: number }
): Promise<void> {
  await frpFetch<void>("/notifications/read", {
    method: "POST",
    body: JSON.stringify(target),
  });
}

/** `POST /notifications/read-all`. */
export async function markAllNotificationsRead(): Promise<void> {
  await frpFetch<void>("/notifications/read-all", { method: "POST" });
}
