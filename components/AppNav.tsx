"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  House,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Package,
  PackageSearch,
  Settings2,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ACCESS_KEYS, type AccessKey } from "@/lib/frp/access";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Access key (looked up in ACCESS_PRIVILEGE_MAP) required to see this link. Omit for always-visible links. */
  accessKey?: AccessKey;
};

const orgUserManagerLinks: NavLink[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: House,
    accessKey: ACCESS_KEYS.DASHBOARD_VIEW,
  },
  {
    href: "/jobs",
    label: "Jobs",
    icon: ListChecks,
    accessKey: ACCESS_KEYS.JOBS_VIEW,
  },
  {
    href: "/quotes",
    label: "Quotes",
    icon: PackageSearch,
    accessKey: ACCESS_KEYS.QUOTES_VIEW,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    accessKey: ACCESS_KEYS.ANALYTICS_VIEW,
  },
  { href: "/settings/profile", label: "Profile", icon: UserCircle },
];

const superAdminLinks: NavLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/privileges", label: "Privileges", icon: KeyRound },
  { href: "/admin/parameters", label: "Parameters", icon: Settings2 },
  { href: "/settings/profile", label: "Profile", icon: UserCircle },
];

const orgAdminLinks: NavLink[] = [
  { href: "/org", label: "Dashboard", icon: LayoutDashboard },
  { href: "/org/users", label: "Users", icon: Users },
  { href: "/org/roles", label: "Roles", icon: Shield },
  { href: "/org/inventory", label: "Inventory", icon: Package },
  { href: "/org/integrations", label: "Integrations", icon: Settings2 },
  { href: "/org/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/profile", label: "Profile", icon: UserCircle },
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
  const { appRole, isAuthenticated, can } = useAuth();

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

  // Org admins are always seeded with every non-platform privilege (see
  // PRIVILEGE_MODEL.md), so only custom-role org users can ever be missing
  // one — but the filter runs for everyone, it just never removes anything
  // for the other roles since they have no `accessKey` requirement set.
  links = links.filter((link) => !link.accessKey || can(link.accessKey));

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
