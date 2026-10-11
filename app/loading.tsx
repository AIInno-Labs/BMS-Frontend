import { FrpLogo } from "@/components/FrpLogo";

export default function GlobalLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA]">
      <div className="flex flex-col items-center gap-4">
        <FrpLogo variant="lockup" className="scale-125" />
        <p className="animate-pulse text-sm font-medium tracking-wide text-slate-600">
          Loading workspace...
        </p>
      </div>
    </main>
  );
}
