"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * Debounced search input. Owns only the input UX (draft state, 250ms
 * debounce, Enter-to-commit-immediately, resync when `value` changes from
 * outside e.g. browser back/forward) — the caller decides what "commit"
 * means (update this page's own URL, navigate elsewhere, etc).
 */
export function PageSearchBox({
  value,
  onCommit,
  placeholder,
  srLabel,
  className = "",
  minLength = 0,
}: {
  value: string;
  onCommit: (trimmed: string) => void;
  placeholder: string;
  srLabel: string;
  className?: string;
  /** Below this many characters, typing updates the box but doesn't commit
   *  (no URL/API call) — clearing back to empty still commits, to reset
   *  an active search. */
  minLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const meetsMinLength = (next: string) => {
    const trimmed = next.trim();
    return trimmed.length === 0 || trimmed.length >= minLength;
  };

  const commit = (next: string) => {
    if (!meetsMinLength(next)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onCommit(next);
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!meetsMinLength(next)) return;
    debounceRef.current = setTimeout(() => onCommit(next), 250);
  };

  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{srLabel}</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] py-1.5 pl-9 pr-3 text-sm text-[#111827] outline-none placeholder:text-slate-400 focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
      />
    </label>
  );
}
