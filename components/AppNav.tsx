"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  House,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  PackageSearch,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type NavLink = { href: string; label: string; icon: LucideIcon };

const orgUserManagerLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: House },
  { href: "/jobs", label: "Jobs", icon: ListChecks },
  { href: "/quotes", label: "Quotes", icon: PackageSearch },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings/security", label: "Security", icon: Settings2 },
];

const superAdminLinks: NavLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/privileges", label: "Privileges", icon: KeyRound },
  { href: "/admin/parameters", label: "Parameters", icon: Settings2 },
  { href: "/settings/security", label: "Security", icon: Settings2 },
];

const orgAdminLinks: NavLink[] = [
  { href: "/org", label: "Dashboard", icon: LayoutDashboard },
  { href: "/org/users", label: "Users", icon: Users },
  { href: "/org/roles", label: "Roles", icon: Shield },
  { href: "/org/integrations", label: "Integrations", icon: Settings2 },
  { href: "/settings/security", label: "Security", icon: Settings2 },
];

function NavLinkItem({ href, label, icon: Icon }: NavLink) {
  const pathname = usePathname();
  const active =
    href === "/" || href === "/admin" || href === "/org"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-orange-50 text-orange-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function AppNav({ compact = false }: { compact?: boolean }) {
  const { appRole, isAuthenticated } = useAuth();

  let sectionLabel: string | null = null;
  let links: NavLink[] = orgUserManagerLinks;

  if (isAuthenticated && appRole === "superadmin") {
    sectionLabel = "Super Admin";
    links = superAdminLinks;
  } else if (isAuthenticated && appRole === "orgadmin") {
    sectionLabel = "Organization Admin";
    links = orgAdminLinks;
  } else {
    sectionLabel = isAuthenticated ? "Workspace" : null;
    links = orgUserManagerLinks;
  }

  return (
    <nav
      className={`flex min-w-0 flex-col gap-1 ${compact ? "" : "py-2"}`}
      aria-label="Main navigation"
    >
      {sectionLabel && (
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {sectionLabel}
        </p>
      )}
      {links.map((link) => (
        <NavLinkItem key={link.href} {...link} />
      ))}
    </nav>
  );
}
