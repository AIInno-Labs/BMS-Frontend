"use client";

import {
  PERSONA_LABELS,
  PERSONA_SHORT_LABELS,
  type Persona,
  usePersona,
} from "@/context/PersonaContext";

const options: Persona[] = ["manager", "worker"];

export function PersonaSwitcher() {
  const { persona, setPersona } = usePersona();

  return (
    <div
      className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 shadow-sm"
      role="group"
      aria-label="Switch user role"
    >
      <span className="hidden whitespace-nowrap text-sm text-slate-600 md:inline">
        Viewing as{" "}
        <span className="font-semibold text-slate-900">
          {PERSONA_SHORT_LABELS[persona]}
        </span>
      </span>
      <div className="flex h-8 gap-0.5 rounded-md bg-slate-100 p-0.5">
        {options.map((option) => {
          const active = persona === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setPersona(option)}
              aria-pressed={active}
              className={`flex h-full items-center rounded px-3 text-sm font-semibold transition-all duration-150 ease-in-out ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              {PERSONA_LABELS[option]
                .replace("Production ", "")
                .replace("Factory ", "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
