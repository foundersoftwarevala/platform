import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AMSection } from "./AMFullSidebar";

interface AMContextValue {
  section: AMSection;
  setSection: (section: AMSection) => void;
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
  openSession: (id: string, section?: AMSection) => void;
}

const AMContext = createContext<AMContextValue | null>(null);

export function AMProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<AMSection>("assist_dashboard");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const value = useMemo<AMContextValue>(
    () => ({
      section,
      setSection,
      selectedSessionId,
      setSelectedSessionId,
      openSession: (id, target = "live_assist") => {
        setSelectedSessionId(id);
        setSection(target);
      },
    }),
    [section, selectedSessionId],
  );

  return <AMContext.Provider value={value}>{children}</AMContext.Provider>;
}

export function useAM() {
  const ctx = useContext(AMContext);
  if (!ctx) throw new Error("useAM must be used inside AMProvider");
  return ctx;
}