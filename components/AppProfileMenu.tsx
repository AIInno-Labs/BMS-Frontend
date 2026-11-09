"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function AppProfileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    appRole,
    homePath,
    canManageOrganizations,
    canManageRoles,
    logout,
  } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initials = (user?.displayName || user?.username || "FR")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleLabel =
    appRole === "superadmin"
      ? "Super Admin"
      : appRole === "orgadmin"
        ? "Org Admin"
        : appRole === "orguser"
          ? "Org User"
          : "Guest";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 text-slate-700 transition-colors hover:border-orange-200 hover:bg-orange-50/50"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
          {isAuthenticated ? initials : "?"}
        </span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-slate-500 sm:block ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-[#111827]">
              {isAuthenticated
                ? user?.displayName || user?.username || "Signed in"
                : "Not signed in"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{roleLabel}</p>
          </div>

          {isAuthenticated && (
            <Link
              href={homePath}
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4 text-slate-500" aria-hidden />
              My dashboard
            </Link>
          )}

          {isAuthenticated && canManageOrganizations && (
            <>
              <Link
                href="/admin/organizations"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <Building2 className="h-4 w-4 text-slate-500" aria-hidden />
                Organizations
              </Link>
              <Link
                href="/admin/privileges"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <KeyRound className="h-4 w-4 text-slate-500" aria-hidden />
                Privileges
              </Link>
            </>
          )}

          {isAuthenticated && canManageRoles && (
            <Link
              href="/org/roles"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <Shield className="h-4 w-4 text-slate-500" aria-hidden />
              Roles
            </Link>
          )}

          {!isAuthenticated && (
            <Link
              href="/login"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <LogIn className="h-4 w-4 text-slate-500" aria-hidden />
              Sign in
            </Link>
          )}

          {isAuthenticated && (
            <>
              <Link
                href="/settings/profile"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <User className="h-4 w-4 text-slate-500" aria-hidden />
                <span className="truncate">{user?.email || "Profile"}</span>
              </Link>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={async () => {
                  setOpen(false);
                  await logout();
                  router.push("/login");
                }}
              >
                <LogOut className="h-4 w-4 text-slate-500" aria-hidden />
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
