"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

interface ScoutContextValue {
  readonly open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const ScoutContext = createContext<ScoutContextValue | null>(null);

export function ScoutProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ScoutContext.Provider value={{ open, toggle: () => setOpen((o) => !o), setOpen }}>
      {children}
    </ScoutContext.Provider>
  );
}

export function useScout(): ScoutContextValue {
  const ctx = useContext(ScoutContext);
  if (!ctx) throw new Error("useScout must be used within a ScoutProvider");
  return ctx;
}
