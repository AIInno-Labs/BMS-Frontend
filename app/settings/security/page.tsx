"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  disableMfa,
  enableMfa,
  setupMfa,
} from "@/lib/frp/api";
import type { MfaSetupResponse } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export default function SecuritySettingsPage() {
  const { user, loading, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  async function onStartSetup() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await setupMfa();
      setSetup(res);
      setCode("");
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Setup failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function onEnable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await enableMfa(code.trim());
      setSetup(null);
      setCode("");
      await refreshUser();
      setMessage("Authenticator MFA is enabled.");
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Enable failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDisable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await disableMfa(password, code.trim());
      setPassword("");
      setCode("");
      await refreshUser();
      setMessage("Authenticator MFA is disabled.");
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Disable failed"
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !isAuthenticated) {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  const mfaAvailable = Boolean(user?.mfaAvailable);
  const totpEnabled = Boolean(user?.totpEnabled);

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Account
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#111827]">Security</h2>
        <p className="mt-1 text-sm text-slate-600">
          Optional two-factor authentication with Microsoft Authenticator (TOTP).
        </p>

        <div className="app-card mt-6 space-y-4 !p-5">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">
              Authenticator app (TOTP)
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Status:{" "}
              {!mfaAvailable
                ? "MFA is not enabled for your organization (Super Admin must set MFA_TOTP_ENABLED)"
                : totpEnabled
                  ? "Enabled"
                  : "Available — not enrolled"}
            </p>
          </div>

          {!mfaAvailable && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              When your organization has MFA enabled, you can set up Microsoft
              Authenticator here and it will be required at sign-in.
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          )}

          {mfaAvailable && !totpEnabled && !setup && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStartSetup()}
              className="btn-primary disabled:opacity-60"
            >
              {busy ? "Starting…" : "Set up Microsoft Authenticator"}
            </button>
          )}

          {setup && (
            <form onSubmit={onEnable} className="space-y-4">
              <p className="text-sm text-slate-600">
                Scan this QR code in Microsoft Authenticator, then enter the
                6-digit code.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrCodeDataUri}
                alt="MFA QR code"
                className="mx-auto h-48 w-48 rounded-xl border border-slate-200 bg-white p-2"
              />
              <p className="break-all font-mono text-xs text-slate-500">
                Manual key: {setup.secret}
              </p>
              <div>
                <label className={labelClass} htmlFor="enableCode">
                  Authenticator code
                </label>
                <input
                  id="enableCode"
                  className={inputClass}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  minLength={6}
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full disabled:opacity-60"
              >
                {busy ? "Enabling…" : "Enable MFA"}
              </button>
            </form>
          )}

          {mfaAvailable && totpEnabled && (
            <form onSubmit={onDisable} className="space-y-4">
              <p className="text-sm text-slate-600">
                Disable requires your password and a current authenticator code.
              </p>
              <div>
                <label className={labelClass} htmlFor="pwd">
                  Password
                </label>
                <input
                  id="pwd"
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="disableCode">
                  Authenticator code
                </label>
                <input
                  id="disableCode"
                  className={inputClass}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  minLength={6}
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {busy ? "Disabling…" : "Disable MFA"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
