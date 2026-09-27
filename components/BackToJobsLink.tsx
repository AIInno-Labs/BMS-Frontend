"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getJobsListReturnUrl } from "@/lib/frp/jobs-list-return";

/**
 * Links back to the jobs list, restoring any filters that were active when
 * the user left (group, status, search, due dates, etc.).
 */
export function BackToJobsLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [href, setHref] = useState("/jobs");

  useEffect(() => {
    setHref(getJobsListReturnUrl());
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
