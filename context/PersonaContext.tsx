"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { DEMO_WORKER_ID, getWorkerDisplayName } from "@/lib/workers";

export type Persona = "manager" | "worker";

export const PERSONA_LABELS: Record<Persona, string> = {
  manager: "Production Manager",
  worker: "Factory Worker",
};

export const PERSONA_SHORT_LABELS: Record<Persona, string> = {
  manager: "Manager",
  worker: "Worker",
};

interface PersonaContextValue {
  persona: Persona;
  setPersona: (persona: Persona) => void;
  isManager: boolean;
  isWorker: boolean;
  workerId: string;
  workerName: string;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>("manager");

  const setPersona = useCallback((next: Persona) => {
    setPersonaState(next);
  }, []);

  const value = useMemo(
    () => ({
      persona,
      setPersona,
      isManager: persona === "manager",
      isWorker: persona === "worker",
      workerId: DEMO_WORKER_ID,
      workerName: getWorkerDisplayName(DEMO_WORKER_ID),
    }),
    [persona, setPersona]
  );

  return (
    <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
  );
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error("usePersona must be used within PersonaProvider");
  }
  return ctx;
}
