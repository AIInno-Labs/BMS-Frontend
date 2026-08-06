"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  authenticate as apiAuthenticate,
  fetchMe,
  FRP_ACCESS_TOKEN_KEY,
  FRP_REFRESH_TOKEN_KEY,
  logout as apiLogout,
  refreshSession,
  setFrpAccessTokenGetter,
  setFrpSessionUpdater,
  verifyMfa as apiVerifyMfa,
} from "@/lib/frp/api";
import {
  homePathForRole,
  resolveAppRole,
  type AppRole,
} from "@/lib/frp/roles";
import { hasAccess, type AccessKey } from "@/lib/frp/access";
import type { AuthenticationResponse, UserDTO } from "@/lib/frp/types";

export type LoginResult =
  | { status: "authenticated"; user: UserDTO }
  | { status: "requires2fa"; mfaToken: string };

interface AuthContextValue {
  user: UserDTO | null;
  accessToken: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  appRole: AppRole;
  homePath: string;
  isPlatformSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isOrgUser: boolean;
  canManageOrganizations: boolean;
  canManageRoles: boolean;
  privileges: string[];
  can: (key: AccessKey) => boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeMfaLogin: (mfaToken: string, code: string) => Promise<UserDTO>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function applySession(res: AuthenticationResponse) {
  if (!res.token || !res.refreshToken) {
    throw new Error("Authentication response missing tokens");
  }
  localStorage.setItem(FRP_ACCESS_TOKEN_KEY, res.token);
  localStorage.setItem(FRP_REFRESH_TOKEN_KEY, res.refreshToken);
  return { token: res.token, refreshToken: res.refreshToken };
}

function clearLocalSession() {
  localStorage.removeItem(FRP_ACCESS_TOKEN_KEY);
  localStorage.removeItem(FRP_REFRESH_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFrpAccessTokenGetter(() => readStored(FRP_ACCESS_TOKEN_KEY) ?? accessToken);
  }, [accessToken]);

  useEffect(() => {
    setFrpSessionUpdater((tokens) => {
      if (!tokens) {
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        return;
      }
      setAccessToken(tokens.token);
      setRefreshToken(tokens.refreshToken);
    });
    return () => setFrpSessionUpdater(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = readStored(FRP_ACCESS_TOKEN_KEY);
    if (!token) {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      return;
    }
    setAccessToken(token);
    setRefreshToken(readStored(FRP_REFRESH_TOKEN_KEY));
    const me = await fetchMe();
    setUser(me);
  }, []);

  // The bootstrap itself runs inside a ref-cached promise, not directly in
  // the effect body: React Strict Mode (dev only) mounts every component
  // twice, and a plain `cancelled` flag only suppresses which invocation's
  // *result* gets applied — it doesn't stop the second invocation from
  // firing its own refreshSession()/fetchMe() calls. Caching the promise
  // means both mounts share the same in-flight network round trip, so the
  // session check only ever hits the API once per real app load.
  const bootstrapRef = useRef<Promise<void> | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!bootstrapRef.current) {
      bootstrapRef.current = (async () => {
        try {
          let token = readStored(FRP_ACCESS_TOKEN_KEY);
          const rt = readStored(FRP_REFRESH_TOKEN_KEY);

          if (!token && !rt) return;

          if (!token && rt) {
            const session = await refreshSession();
            token = session.token;
            setAccessToken(session.token);
            setRefreshToken(session.refreshToken);
          } else {
            setAccessToken(token);
            setRefreshToken(rt);
          }

          try {
            const me = await fetchMe();
            setUser(me);
          } catch {
            if (!rt && !readStored(FRP_REFRESH_TOKEN_KEY)) throw new Error("session");
            const session = await refreshSession();
            setAccessToken(session.token);
            setRefreshToken(session.refreshToken);
            const me = await fetchMe();
            setUser(me);
          }
        } catch {
          clearLocalSession();
          setAccessToken(null);
          setRefreshToken(null);
          setUser(null);
        }
      })();
    }
    bootstrapRef.current.finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiAuthenticate(email, password);
    if (res.requires2fa && res.mfaToken) {
      return { status: "requires2fa" as const, mfaToken: res.mfaToken };
    }
    const session = applySession(res);
    setAccessToken(session.token);
    setRefreshToken(session.refreshToken);
    const me = await fetchMe();
    setUser(me);
    return { status: "authenticated" as const, user: me };
  }, []);

  const completeMfaLogin = useCallback(async (mfaToken: string, code: string) => {
    const res = await apiVerifyMfa(mfaToken, code);
    const session = applySession(res);
    setAccessToken(session.token);
    setRefreshToken(session.refreshToken);
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    const rt = readStored(FRP_REFRESH_TOKEN_KEY) ?? refreshToken;
    try {
      if (rt) await apiLogout(rt);
    } catch {
      /* still clear local session */
    }
    clearLocalSession();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [refreshToken]);

  const privileges = user?.rolesPrivileges ?? [];
  const appRole = resolveAppRole(user);
  const isPlatformSuperAdmin = appRole === "superadmin";
  const isOrgAdmin = appRole === "orgadmin";
  const isOrgUser = appRole === "orguser";
  const canManageOrganizations =
    isPlatformSuperAdmin ||
    privileges.includes("ORGANIZATION_CREATE") ||
    privileges.includes("ORGANIZATION_READ_ALL");
  const canManageRoles =
    isOrgAdmin ||
    privileges.includes("ROLE_CREATE") ||
    privileges.includes("ROLE_READ");
  const can = useCallback(
    (key: AccessKey) => hasAccess(user, key),
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      isAuthenticated: Boolean(accessToken && user),
      appRole,
      homePath: homePathForRole(appRole),
      isPlatformSuperAdmin,
      isOrgAdmin,
      isOrgUser,
      canManageOrganizations,
      canManageRoles,
      privileges,
      can,
      login,
      completeMfaLogin,
      logout,
      refreshUser,
    }),
    [
      user,
      accessToken,
      loading,
      appRole,
      isPlatformSuperAdmin,
      isOrgAdmin,
      isOrgUser,
      canManageOrganizations,
      canManageRoles,
      privileges,
      can,
      login,
      completeMfaLogin,
      logout,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
