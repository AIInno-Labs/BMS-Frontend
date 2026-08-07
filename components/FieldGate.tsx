"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { FieldKey } from "@/lib/frp/access";
import type { FieldAccessMode } from "@/lib/frp/privilege-types";

type FieldGateProps = {
  /** Catalog `fieldKey` (see FIELD_KEYS / FIELD_PRIVILEGE_MAP). */
  fieldKey: FieldKey;
  /** Defaults to READ (show). Use WRITE to allow edit controls. */
  mode?: FieldAccessMode;
  children: ReactNode;
  /** Rendered when the user lacks the FIELD privilege. Defaults to nothing. */
  fallback?: ReactNode;
};

/**
 * Hides children unless `canField(fieldKey, mode)` is true.
 * Unmapped field keys always pass (see access.ts).
 */
export function FieldGate({
  fieldKey,
  mode = "READ",
  children,
  fallback = null,
}: FieldGateProps) {
  const { canField } = useAuth();
  if (!canField(fieldKey, mode)) return <>{fallback}</>;
  return <>{children}</>;
}
