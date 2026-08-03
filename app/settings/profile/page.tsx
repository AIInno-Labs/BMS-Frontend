"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { canEditOwnProfile, updateMyProfile } from "@/lib/frp/api";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 disabled:bg-slate-50 disabled:text-slate-500";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-1.5 text-sm font-medium text-[#0F172A]">{value || "—"}</p>
    </div>
  );
}

export default function ProfileSettingsPage() {
  const { user, loading, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Seed the form once the profile arrives, and after every refresh.
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "");
      setMobileNumber(user.mobileNumber ?? "");
    }
  }, [user]);

  const editable = canEditOwnProfile(user);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await updateMyProfile(user, {
        displayName: displayName.trim(),
        mobileNumber: mobileNumber.trim() || undefined,
      });
      await refreshUser();
      setMessage("Profile updated.");
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Update failed"
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !isAuthenticated || !user) {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  const dirty =
    displayName.trim() !== (user.displayName ?? "") ||
    mobileNumber.trim() !== (user.mobileNumber ?? "");

  const roleCodes = user.roleCodes ?? [];
  const privileges = user.rolesPrivileges ?? [];

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Account
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#111827]">Profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Your personal details and the access this account carries.
        </p>

        <form onSubmit={onSave} className="app-card mt-6 space-y-4 !p-5">
          <h3 className="text-sm font-semibold text-[#111827]">Personal details</h3>

          {!editable && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Editing your own details is not available yet — the backend has no
              self-service profile endpoint. Ask an organization admin to update
              them for you in the meantime.
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

          <div>
            <label className={labelClass} htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              className={inputClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!editable || busy}
              required
              maxLength={120}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="mobileNumber">
              Mobile number
            </label>
            <input
              id="mobileNumber"
              className={inputClass}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              disabled={!editable || busy}
              inputMode="tel"
              maxLength={20}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Email (sign-in)" value={user.email ?? ""} />
            <ReadOnlyField label="Designation" value={user.designation ?? ""} />
          </div>

          {editable && (
            <button
              type="submit"
              disabled={busy || !dirty || displayName.trim().length === 0}
              className="btn-primary disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          )}
        </form>

        <div className="app-card mt-4 space-y-4 !p-5">
          <h3 className="text-sm font-semibold text-[#111827]">Organization</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField
              label="Organization"
              value={user.organization?.companyName ?? "Platform (no tenant)"}
            />
            <ReadOnlyField
              label="Organization code"
              value={user.organization?.companyCode ?? "—"}
            />
          </div>
        </div>

        <div className="app-card mt-4 space-y-4 !p-5">
          <h3 className="text-sm font-semibold text-[#111827]">Access</h3>

          <div>
            <p className={labelClass}>Roles</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {roleCodes.length === 0 ? (
                <p className="text-sm text-slate-500">No roles assigned</p>
              ) : (
                roleCodes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    {code}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <p className={labelClass}>
              Privileges ({privileges.length})
            </p>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              {privileges.length === 0 ? (
                <p className="px-1 text-sm text-slate-500">
                  No privileges granted
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {[...privileges].sort().map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Link
          href="/settings/security"
          className="app-card mt-4 flex items-center gap-3 !p-5 transition-colors hover:bg-slate-50"
        >
          <ShieldCheck className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#111827]">
              Security
            </span>
            <span className="block text-sm text-slate-600">
              Two-factor authentication —{" "}
              {user.totpEnabled ? "enabled" : "not enrolled"}
            </span>
          </span>
        </Link>
      </div>
    </main>
  );
}
