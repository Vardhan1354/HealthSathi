import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReadAloudButton from "../components/ReadAloudButton";

interface Alert {
  id: string;
  title: string;
  body: string;
  type: "critical" | "warning" | "info" | "success";
  village: string;
  time: string;
  read: boolean;
}

const INITIAL_ALERTS: Alert[] = [
  { id: "a1", title: "Fever Cluster — Kolwadi", body: "18 fever cases reported in 4 days. Possible respiratory outbreak. Mobile clinic deployment recommended.", type: "critical", village: "Kolwadi", time: "4h ago", read: false },
  { id: "a2", title: "Suspected Dengue — Hingoli", body: "12 cases with high fever + rash. 3 patients referred to district hospital. Mosquito fogging needed.", type: "critical", village: "Hingoli", time: "6h ago", read: false },
  { id: "a3", title: "Water Contamination Risk — Shegaon", body: "7 GI infection cases traced to possibly contaminated water source near river. Water testing required.", type: "warning", village: "Shegaon", time: "1d ago", read: false },
  { id: "a4", title: "5 Malaria-like Cases — Sonpeth", body: "5 patients with malaria-like symptoms near river. RDT testing kits needed. Anti-malarial stock to be replenished.", type: "warning", village: "Sonpeth", time: "1d ago", read: true },
  { id: "a5", title: "Stock Alert: ORS Running Low", body: "ORS packets at PHC Shegaon estimated to last only 3 more days. Resupply request sent.", type: "warning", village: "PHC Shegaon", time: "2d ago", read: true },
  { id: "a6", title: "Vaccination Drive Completed", body: "154 children vaccinated in Kolwadi, Hingoli, Sonpeth. 98% coverage achieved. 6 children missed — follow-up needed.", type: "success", village: "Multiple", time: "3d ago", read: true },
  { id: "a7", title: "Cold Chain Maintained", body: "Monthly cold chain check completed. All vaccine storage temperatures within safe range.", type: "success", village: "PHC District", time: "5d ago", read: true },
  { id: "a8", title: "New Protocol: Dengue Management", body: "Updated dengue management guidelines issued by District Health Officer. Please review the protocol document.", type: "info", village: "—", time: "6d ago", read: true },
];

type FilterType = "all" | "unread" | "critical" | "warning" | "info";

const ICON = { critical: "🚨", warning: "⚠️", info: "ℹ️", success: "✅" };
const BADGE: Record<Alert["type"], string> = { critical: "badge-danger", warning: "badge-warning", info: "badge-info", success: "badge-success" };
const BORDER: Record<Alert["type"], string> = { critical: "border-l-4 border-hs-red", warning: "border-l-4 border-hs-yellow", info: "border-l-4 border-hs-blue", success: "border-l-4 border-hs-green" };

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [filter, setFilter] = useState<FilterType>("all");

  const markRead = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));

  const filtered = alerts.filter(a => {
    if (filter === "unread") return !a.read;
    if (filter === "critical") return a.type === "critical";
    if (filter === "warning") return a.type === "warning";
    if (filter === "info") return a.type === "info" || a.type === "success";
    return true;
  });

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="min-h-full bg-hs-bg">
      <div className="sticky top-0 z-10 bg-white border-b border-hs-border px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-icon border-0">
          <svg className="w-5 h-5 text-hs-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-hs-text">Alerts</h1>
        {unreadCount > 0 ? (
          <button onClick={markAllRead} className="text-xs text-hs-blue font-semibold">Mark all read</button>
        ) : (
          <span className="badge-success text-xs">All read</span>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "unread", "critical", "warning", "info"] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap min-h-[44px] capitalize
                ${filter === f ? "bg-hs-blue text-white border-hs-blue" : "bg-white text-hs-text-secondary border-hs-border"}`}>
              {f === "unread" ? `Unread (${unreadCount})` : f === "all" ? "All" : f === "critical" ? "🚨 Critical" : f === "warning" ? "⚠️ Warning" : "ℹ️ Info"}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {filtered.length === 0 && (
          <div className="hs-card text-center text-hs-text-secondary text-sm py-10">
            ✅ No alerts in this category
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(alert => (
            <button key={alert.id} onClick={() => markRead(alert.id)}
              className={`w-full hs-card text-left ${BORDER[alert.type]} ${!alert.read ? "bg-white shadow-card" : "bg-white"} transition-all`}>
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 flex-shrink-0">{ICON[alert.type]}</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-bold text-hs-text leading-snug ${!alert.read ? "" : "opacity-70"}`}>{alert.title}</p>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`${BADGE[alert.type]} text-xs`}>{alert.type}</span>
                      {!alert.read && <span className="w-2 h-2 rounded-full bg-hs-blue" />}
                    </div>
                  </div>
                  <p className="text-xs text-hs-text-secondary mt-0.5">{alert.village} · {alert.time}</p>
                  <p className="text-sm text-hs-text-secondary mt-2 leading-relaxed">{alert.body}</p>
                  <div className="mt-2">
                    <ReadAloudButton text={`${alert.title}. ${alert.body}`} variant="light" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


