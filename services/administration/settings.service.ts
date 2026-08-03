import { PROFILE_DATA } from "@/constants/administration/profile";
import { QUOTIENT_CONFIG } from "@/constants/administration/quotient";
import { SHAREPOINT_CONFIG } from "@/constants/administration/sharepoint";
import type {
  ProfileData,
  QuotientConfig,
  SharePointConfig,
} from "@/lib/administration/types";

let sharepointStore: SharePointConfig = { ...SHAREPOINT_CONFIG };
let quotientStore: QuotientConfig = { ...QUOTIENT_CONFIG };
let profileStore: ProfileData = { ...PROFILE_DATA };

export function getSharePointConfig(): Promise<SharePointConfig> {
  return Promise.resolve(sharepointStore);
}

export function saveSharePointConfig(
  config: SharePointConfig
): Promise<SharePointConfig> {
  sharepointStore = { ...config };
  return Promise.resolve(sharepointStore);
}

export function testSharePointConnection(): Promise<{ ok: boolean; message: string }> {
  const ok = Boolean(sharepointStore.tenantId && sharepointStore.clientId);
  return Promise.resolve({
    ok,
    message: ok
      ? "Connection succeeded."
      : "Provide Tenant ID and Client ID before testing the connection.",
  });
}

export function getQuotientConfig(): Promise<QuotientConfig> {
  return Promise.resolve(quotientStore);
}

export function saveQuotientConfig(config: QuotientConfig): Promise<QuotientConfig> {
  quotientStore = { ...config };
  return Promise.resolve(quotientStore);
}

export function testQuotientConnection(): Promise<{ ok: boolean; message: string }> {
  const ok = Boolean(quotientStore.apiBaseUrl && quotientStore.apiKey);
  return Promise.resolve({
    ok,
    message: ok ? "Connection succeeded." : "API base URL and key are required.",
  });
}

export function getProfile(): Promise<ProfileData> {
  return Promise.resolve(profileStore);
}

export function updateProfile(patch: Partial<ProfileData>): Promise<ProfileData> {
  profileStore = { ...profileStore, ...patch };
  return Promise.resolve(profileStore);
}

export function changePassword(): Promise<{ ok: boolean }> {
  return Promise.resolve({ ok: true });
}
