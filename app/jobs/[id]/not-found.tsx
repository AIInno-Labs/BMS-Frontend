import Link from "next/link";

export default function JobNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Job Not Found
      </h1>
      <p className="mt-2 text-base text-slate-600">
        This fabrication job ID is not in the FRP Engineering system.
      </p>
      <Link href="/jobs" className="btn-primary mt-8">
        Back to Jobs
      </Link>
    </main>
  );
}
