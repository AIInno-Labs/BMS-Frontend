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
      else if (typeof o.businessErrorDescription === "string" && o.businessErrorDescription) {
        message = o.businessErrorDescription;
      } else if (typeof o.message === "string" && o.message) {
        message = o.message;
      }
    }
  } catch {
    /* ignore */
  }
  return new FrpApiError(res.status, message, body);
}

async function performTokenRefresh(refreshToken: string): Promise<SessionTokens> {
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

export async function disableMfa(password: string, code: string): Promise<void> {
  await frpFetch("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify({ password, code }),
  });
}

export async function listParameters(
  organizationId?: number | null
): Promise<ApplicationParameterDTO[]> {
  const q =
    organizationId != null ? `?organizationId=${organizationId}` : "";
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

export async function createPrivilege(body: PrivilegeDTO): Promise<PrivilegeDTO> {
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
