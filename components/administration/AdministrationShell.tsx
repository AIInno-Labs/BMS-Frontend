import type { ReactNode } from "react";
import { AdministrationHeader } from "@/components/administration/AdministrationHeader";
import { AdministrationSidebar } from "@/components/administration/AdministrationSidebar";

export function AdministrationShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F7FA]">
      <AdministrationSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdministrationHeader />
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
