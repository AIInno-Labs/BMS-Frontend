"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FrpLogo } from "@/components/FrpLogo";
import { useAuth } from "@/context/AuthContext";
import { homePathForRole, resolveAppRole } from "@/lib/frp/roles";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export default function LoginPage() {
  const { login, completeMfaLogin, isAuthenticated, homePath, loading } =
    useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(homePath);
    }
  }, [loading, isAuthenticated, homePath, router]);

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (result.status === "requires2fa") {
        setMfaToken(result.mfaToken);
        setMfaCode("");
        return;
      }
      router.replace(homePathForRole(resolveAppRole(result.user)));
    } catch (err) {
      const message =
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitMfa(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setSubmitting(true);
    try {
      const me = await completeMfaLogin(mfaToken, mfaCode.trim());
      router.replace(homePathForRole(resolveAppRole(me)));
    } catch (err) {
      const message =
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Invalid authenticator code";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-mesh-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="app-card w-full max-w-md !p-6 sm:!p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <FrpLogo variant="lockup" size="sidebar" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              FRP platform
            </p>
            <h1 className="mt-1 text-lg font-semibold text-[#111827]">
              {mfaToken ? "Authenticator code" : "Sign in"}
            </h1>
            {mfaToken && (
              <p className="mt-1 text-sm text-slate-600">
                Enter the 6-digit code from Microsoft Authenticator.
              </p>
            )}
          </div>
        </div>

        {mfaToken ? (
          <form onSubmit={onSubmitMfa} className="space-y-4">
            <div>
              <label htmlFor="mfaCode" className={labelClass}>
                Code
              </label>
              <input
                id="mfaCode"
                name="mfaCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                className={inputClass}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
                minLength={6}
                maxLength={8}
              />
            </div>
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              className="w-full text-sm font-semibold text-slate-600 hover:text-slate-900"
              onClick={() => {
                setMfaToken(null);
                setMfaCode("");
                setError(null);
              }}
            >
              Back to email and password
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmitPassword} className="space-y-4">
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
