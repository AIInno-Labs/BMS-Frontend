import type { ReactNode } from "react";
import { AdministrationShell } from "@/components/administration/AdministrationShell";

export default function AdministrationLayout({ children }: { children: ReactNode }) {
  return <AdministrationShell>{children}</AdministrationShell>;
}
