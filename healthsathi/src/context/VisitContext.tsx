import { createContext, useContext, useState } from "react";

export interface Visit {
  id: number;
  location: string;
  disease: string;
  priority: "High" | "Medium";
  scheduledDate: string;
  status: "Scheduled" | "Completed";
}

interface VisitContextType {
  visits: Visit[];
  addVisit: (visit: Omit<Visit, "id" | "status">) => void;
  updateVisitStatus: (id: number, status: Visit["status"]) => void;
}

const VisitContext = createContext<VisitContextType | null>(null);

export function VisitProvider({ children }: { children: React.ReactNode }) {
  const [visits, setVisits] = useState<Visit[]>([]);

  function addVisit(visitData: Omit<Visit, "id" | "status">) {
    const newVisit: Visit = {
      id: Date.now(),
      status: "Scheduled",
      ...visitData,
    };

    setVisits((prev) => [...prev, newVisit]);
  }

  function updateVisitStatus(id: number, status: Visit["status"]) {
    setVisits((prev) =>
      prev.map((visit) =>
        visit.id === id ? { ...visit, status } : visit
      )
    );
  }

  return (
    <VisitContext.Provider value={{ visits, addVisit, updateVisitStatus }}>
      {children}
    </VisitContext.Provider>
  );
}

export function useVisits() {
  const context = useContext(VisitContext);
  if (!context) throw new Error("useVisits must be used inside VisitProvider");
  return context;
}