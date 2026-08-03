"use client";

import { useEffect, useState } from "react";
import { Mail, Phone as PhoneIcon, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { SettingsCard, FormField } from "@/components/administration/ui/SettingsCard";
import { getProfile, updateProfile } from "@/services/administration/settings.service";
import type { ProfileData } from "@/lib/administration/types";

const inputClass =
  "w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow focus:border-[#F97316] focus:ring-2 focus:ring-orange-200/40";

function passwordStrength(password: string): { label: string; segments: number } {
  if (!password) return { label: "", segments: 0 };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const label = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  return { label, segments: score };
}

export function ProfileSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  if (!profile) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  const strength = passwordStrength(newPassword);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    await updateProfile(profile);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Profile Settings"
        subtitle="Manage your personal information and security preferences."
        actions={
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        }
      />

      <div className="space-y-6">
        <SettingsCard icon={UserRound} title="Personal Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name">
              <input
                className={inputClass}
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name">
              <input
                className={inputClass}
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Email Address">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputClass} pl-9`} value={profile.email} readOnly />
            </div>
          </FormField>
          <FormField label="Phone Number">
            <div className="relative">
              <PhoneIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputClass} pl-9`}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
          </FormField>
        </SettingsCard>

        <SettingsCard icon={ShieldCheck} title="Security">
          <FormField label="Current Password">
            <input
              type="password"
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </FormField>
          <FormField label="New Password">
            <input
              type="password"
              className={inputClass}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < strength.segments ? "bg-emerald-500" : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
            {strength.label && (
              <p className="mt-1.5 text-xs text-slate-500">Password strength: {strength.label}</p>
            )}
          </FormField>
          <FormField label="Confirm New Password">
            <input
              type="password"
              className={inputClass}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
        </SettingsCard>
      </div>
    </div>
  );
}
