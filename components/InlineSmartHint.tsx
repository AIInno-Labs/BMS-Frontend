import { Info } from "lucide-react";

type InlineSmartHintVariant = "blue" | "text" | "indigo";

interface InlineSmartHintProps {
  variant: InlineSmartHintVariant;
  children: React.ReactNode;
}

export function InlineSmartHint({ variant, children }: InlineSmartHintProps) {
  if (variant === "text") {
    return (
      <p className="max-w-md text-center text-base italic leading-relaxed text-slate-600">
        {children}
      </p>
    );
  }

  if (variant === "blue") {
    return (
      <div
        className="flex max-w-md gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4"
        role="note"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden />
        <p className="text-base leading-relaxed text-slate-700">{children}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-violet-100 bg-violet-50 px-5 py-4"
      role="note"
    >
      <p className="text-base leading-relaxed text-violet-900">{children}</p>
    </div>
  );
}
