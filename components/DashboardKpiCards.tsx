import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Cog,
  FileWarning,
  Hourglass,
  Layers,
} from "lucide-react";
import { useJobs } from "@/context/JobsContext";
import { useAuth } from "@/context/AuthContext";
import { ACCESS_KEYS } from "@/lib/frp/access";

type CardGroup = "overview" | "pipeline";

const cardBase =
  "min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/80";

function KpiLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </p>
  );
}

function KpiValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xl font-semibold leading-none tracking-tight text-slate-900">
      {children}
    </p>
  );
}

type KpiCard = {
  key: string;
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  iconClass: string;
  group: CardGroup;
};

export function DashboardKpiCards() {
  // Org-wide aggregates from GET /jobs/counts — one card per field on the DTO.
  const { counts } = useJobs();
  const { can } = useAuth();
  const {
    total,
    active,
    overdue,
    notStarted,
    awaitingApproval,
    ready,
    manufacturing,
    delivered,
  } = counts;

  const allCards: KpiCard[] = [
    {
      key: "total",
      label: "Total jobs",
      value: total,
      href: "/jobs",
      icon: Layers,
      iconClass: "bg-slate-100 text-slate-700",
      group: "overview",
    },
    {
      key: "active",
      label: "Active",
      value: active,
      href: "/jobs",
      icon: BriefcaseBusiness,
      iconClass: "bg-sky-50 text-sky-700",
      group: "overview",
    },
    {
      key: "overdue",
      label: "Overdue",
      value: overdue,
      href: "/jobs",
      icon: AlertTriangle,
      iconClass: "bg-red-50 text-red-700",
      group: "overview",
    },
    {
      key: "delivered",
      label: "Delivered",
      value: delivered,
      href: "/jobs?status=Complete",
      icon: CheckCircle2,
      iconClass: "bg-emerald-50 text-emerald-700",
      group: "overview",
    },
    {
      key: "notStarted",
      label: "Not started",
      value: notStarted,
      href: "/jobs?status=Pending",
      icon: Hourglass,
      iconClass: "bg-rose-50 text-rose-700",
      group: "pipeline",
    },
    {
      key: "awaitingApproval",
      label: "Awaiting approval",
      value: awaitingApproval,
      href: "/jobs?status=Awaiting%20Manager%20Approval",
      icon: ClipboardList,
      iconClass: "bg-violet-50 text-violet-700",
      group: "pipeline",
    },
    {
      key: "ready",
      label: "Ready",
      value: ready,
      href: "/jobs?status=Ready%20to%20Manufacture",
      icon: FileWarning,
      iconClass: "bg-orange-50 text-orange-700",
      group: "pipeline",
    },
    {
      key: "manufacturing",
      label: "Manufacturing",
      value: manufacturing,
      href: "/jobs?status=In%20Fabrication",
      icon: Cog,
      iconClass: "bg-amber-50 text-amber-700",
      group: "pipeline",
    },
  ];

  const groupAllowed: Record<CardGroup, boolean> = {
    overview: can(ACCESS_KEYS.DASHBOARD_VIEW),
    pipeline: can(ACCESS_KEYS.JOBS_VIEW),
  };

  const cards = allCards.filter((card) => groupAllowed[card.group]);

  if (cards.length === 0) return null;

  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.key}
            href={card.href}
            className={cardBase}
            aria-label={`${card.label}: ${card.value}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${card.iconClass}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <div className="mt-1.5">
              <KpiLabel>{card.label}</KpiLabel>
              <KpiValue>{card.value}</KpiValue>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
