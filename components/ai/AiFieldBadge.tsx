import { Sparkles } from "lucide-react";

export function AiFieldBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-100 px-2.5 py-1 text-base font-semibold text-violet-800">
      <Sparkles className="h-4 w-4" aria-hidden />
      AI Generated
    </span>
  );
}
