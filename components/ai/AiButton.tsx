import { Sparkles } from "lucide-react";

interface AiButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit";
}

export function AiButton({
  children,
  onClick,
  disabled,
  loading,
  className = "",
  type = "button",
}: AiButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 ease-in-out hover:bg-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg ${className}`}
    >
      {loading ? (
        <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
      ) : (
        <Sparkles className="h-6 w-6 shrink-0" aria-hidden />
      )}
      {children}
    </button>
  );
}
