import { Spinner } from "@/components/ui/Loading";

export default function GlobalLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA]">
      <Spinner size="xl" />
    </main>
  );
}
