"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  User,
  Users,
  UsersRound,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const topLinks: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/quotes", label: "Quotes", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const adminLinks: NavItem[] = [
  { href: "/administration/users", label: "Users", icon: Users },
  { href: "/administration/roles", label: "Roles", icon: Shield },
  { href: "/administration/privileges", label: "Privileges", icon: KeyRound },
  { href: "/administration/user-role-mapping", label: "User Role Mapping", icon: UsersRound },
  { href: "/administration/audit-logs", label: "Audit Logs", icon: ClipboardList },
];

const settingsLinks: NavItem[] = [
  { href: "/administration/settings/profile", label: "Profile", icon: User },
  { href: "/administration/settings/sharepoint", label: "SharePoint", icon: Settings },
  { href: "/administration/settings/quotient", label: "Quotient", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-orange-50 text-orange-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function AdministrationSidebar() {
  const pathname = usePathname();
  const settingsActive = settingsLinks.some((l) => isActive(pathname, l.href));
  const [settingsOpen, setSettingsOpen] = useState(true);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[#E5E7EB] bg-white px-3 py-4">
      <div className="px-2 pb-4">
        <span className="text-lg font-bold text-[#F97316]">BMSMan</span>
      </div>

      <nav className="flex flex-col gap-1">
        {topLinks.map((link) => (
          <NavRow key={link.href} {...link} active={isActive(pathname, link.href)} />
        ))}
      </nav>

      <p className="mt-6 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Administration
      </p>
      <nav className="flex flex-col gap-1">
        {adminLinks.map((link) => (
          <NavRow key={link.href} {...link} active={isActive(pathname, link.href)} />
        ))}

        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            settingsActive
              ? "bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
          aria-expanded={settingsOpen}
        >
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">Settings</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {settingsOpen && (
          <div className="ml-4 flex flex-col gap-1 border-l border-slate-100 pl-3">
            {settingsLinks.map((link) => (
              <NavRow key={link.href} {...link} active={isActive(pathname, link.href)} />
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
