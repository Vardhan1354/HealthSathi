import { createContext, useContext, useState } from "react";

export interface Alert {
  id: number;
  location: string;
  disease: string;
  riskScore: number;
  priority: "High" | "Medium";
  status: "New" | "Acknowledged" | "Resolved";
}

interface AlertContextType {
  alerts: Alert[];
  generateAlerts: (regions: any[]) => void;
  updateStatus: (id: number, status: Alert["status"]) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  function generateAlerts(regions: any[]) {
    const newAlerts: Alert[] = regions
      .filter((region) => region.riskScore >= 50)
      .map((region, index) => ({
        id: Date.now() + index,
        location: region.name,
        disease: region.disease,
        riskScore: Math.round(region.riskScore),
        priority: region.riskScore >= 80 ? "High" : "Medium",
        status: "New",
      }));

    setAlerts(newAlerts);
  }

  function updateStatus(id: number, status: Alert["status"]) {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, status } : alert
      )
    );
  }

  return (
    <AlertContext.Provider value={{ alerts, generateAlerts, updateStatus }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) throw new Error("useAlerts must be used inside AlertProvider");
  return context;
}