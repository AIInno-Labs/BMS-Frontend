"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JobEmailRulesEditor } from "@/components/notifications/JobEmailRulesEditor";
import { useAuth } from "@/context/AuthContext";
import {
  listJobEmailRecipients,
  listUsers,
  updateJobEmailRecipients,
} from "@/lib/frp/api";
import type { JobEmailRecipientDTO, UserDTO } from "@/lib/frp/types";
import { LoadingState } from "@/components/ui/Loading";

export function NotificationRulesAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [rows, setRows] = useState<JobEmailRecipientDTO[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "orgadmin") {
      router.replace(appRole === "superadmin" ? "/admin" : "/");
    }
  }, [authLoading, isAuthenticated, appRole, router]);

  const loadStartedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !isAuthenticated || appRole !== "orgadmin") return;
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;

    async function load() {
      setUsersLoading(true);
      setRowsLoading(true);
      try {
        const [page, catalog] = await Promise.all([
          listUsers(0, 200),
          listJobEmailRecipients(),
        ]);
        setUsers((page.content ?? []).filter((u) => u.enabled !== false));
        setUsersError(null);
        setRows(catalog.filter((row) => row.eventDef != null));
        setRowsError(null);
      } catch (e) {
        setUsers([]);
        setRows([]);
        const message = e instanceof Error ? e.message : "Could not load notifications";
        setUsersError(message);
        setRowsError(message);
      } finally {
        setUsersLoading(false);
        setRowsLoading(false);
      }
    }
    void load();
  }, [authLoading, isAuthenticated, appRole]);

  async function saveRow(payload: JobEmailRecipientDTO) {
    const next = await updateJobEmailRecipients([payload]);
    setRows(next.filter((row) => row.eventDef != null));
    return next;
  }

  if (authLoading || !isAuthenticated || appRole !== "orgadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <LoadingState />
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Organization Admin
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#111827]">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-slate-600 sm:hidden">
            Who gets emailed for each job event.
          </p>
          <p className="mt-1 hidden text-sm text-slate-600 sm:block">
            Choose which team members — and, where appropriate, the customer
            contact or assigned worker — get emailed when a job reaches each
            event below.
          </p>
        </div>

        <JobEmailRulesEditor
          rows={rows}
          users={users}
          usersLoading={usersLoading}
          usersError={usersError}
          rowsLoading={rowsLoading}
          rowsError={rowsError}
          onSave={saveRow}
        />
      </div>
    </main>
  );
}
