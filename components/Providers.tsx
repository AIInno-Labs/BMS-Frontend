"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";

// Lazy-loaded so /login's bundle doesn't have to include the whole
// authenticated app shell (sidebar nav, header, jobs/persona context) just to
// hydrate a form nobody on that page needs it for. See AuthShell.tsx.
const AuthShell = dynamic(() =>
  import("@/components/AuthShell").then((m) => m.AuthShell)
);

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <AuthProvider>
      {isLogin ? children : <AuthShell>{children}</AuthShell>}
    </AuthProvider>
  );
}
