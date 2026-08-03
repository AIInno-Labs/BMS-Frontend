"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

const inputClass =
  "w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 pr-10 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow focus:border-[#F97316] focus:ring-2 focus:ring-orange-200/40";

export function SecretInput({
  value,
  onChange,
  placeholder,
  readOnly,
  showCopy,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  showCopy?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={`${inputClass} ${showCopy ? "pr-16" : ""} font-mono`}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {showCopy && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Copy"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={visible ? "Hide" : "Show"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
