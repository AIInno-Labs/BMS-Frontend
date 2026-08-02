export interface AuthenticationResponse {
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  requires2fa?: boolean;
  mfaToken?: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpAuthUri: string;
  qrCodeDataUri: string;
}

export interface ApplicationParameterDTO {
  id?: number | null;
  paramName: string;
  paramValue?: string | null;
  paramType?: string | null;
  description?: string | null;
  organizationId?: number | null;
  orgEditable?: boolean | null;
  inherited?: boolean;
}

export interface OrganizationDTO {
  id?: number;
  companyName?: string;
  companyCode?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  mobileNumber?: string;
  email?: string;
  gstNo?: string;
}

export interface CreateOrganizationRequest {
  companyName: string;
  companyCode: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  mobileNumber?: string;
  email?: string;
  gstNo?: string;
  adminPassword: string;
  adminEmail: string;
  adminDisplayName: string;
  adminMobileNumber?: string;
}

export interface OrganizationProvisionResponse {
  organization: OrganizationDTO;
  /** Login identity for the provisioned admin (email). */
  adminUsername: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface UserDTO {
  id?: number;
  username?: string;
  displayName?: string;
  email?: string;
  mobileNumber?: string;
  locale?: string;
  designation?: string;
  authProvider?: string;
  organization?: OrganizationDTO | null;
  rolesPrivileges?: string[];
  roleIds?: number[];
  roleCodes?: string[];
  enabled?: boolean;
  totpEnabled?: boolean;
  mfaAvailable?: boolean;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  mobileNumber?: string;
  roleIds: number[];
}

export interface UpdateUserRequest {
  id: number;
  displayName: string;
  mobileNumber?: string;
  enabled?: boolean;
  roleIds: number[];
  password?: string;
}

export interface RoleDTO {
  id?: number;
  role: string;
  roleCode: string;
  privilegeCodes: string[];
}

export interface PrivilegeDTO {
  id?: number;
  privilege?: string;
  privilegeCode: string;
  privilegeType?: "ACTION" | "MENU" | "FIELD" | string;
  domain?: string;
  fieldKey?: string;
  accessMode?: "READ" | "WRITE" | string;
  parentId?: number | null;
  sortOrder?: number;
  platformOnly?: boolean;
  systemManaged?: boolean;
  active?: boolean;
}

export class FrpApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "FrpApiError";
    this.status = status;
    this.body = body;
  }
}
