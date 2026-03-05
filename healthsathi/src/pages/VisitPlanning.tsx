import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReadAloudButton from "../components/ReadAloudButton";

interface Visit {
  id: string;
  village: string;
  date: string;
  time: string;
  reason: string;
  patients: number;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
}

const INITIAL_VISITS: Visit[] = [
  { id: "v1", village: "Kolwadi", date: "Today", time: "10:00 AM", reason: "Fever outbreak follow-up", patients: 12, status: "in-progress", priority: "high" },
  { id: "v2", village: "Hingoli", date: "Tomorrow", time: "9:00 AM", reason: "Dengue suspected — RDT testing", patients: 8, status: "scheduled", priority: "high" },
  { id: "v3", village: "Shegaon", date: "Wed, 15 Jan", time: "11:00 AM", reason: "GI infection cases + water testing", patients: 5, status: "scheduled", priority: "medium" },
  { id: "v4", village: "Sonpeth", date: "Thu, 16 Jan", time: "2:00 PM", reason: "Malaria screening + follow-up", patients: 7, status: "scheduled", priority: "medium" },
  { id: "v5", village: "Nanded", date: "Fri, 17 Jan", time: "10:30 AM", reason: "Antenatal care + postnatal visits", patients: 4, status: "scheduled", priority: "low" },
  { id: "v6", village: "Parbhani", date: "Mon, 13 Jan", time: "9:00 AM", reason: "Routine health camp", patients: 23, status: "completed", priority: "low" },
];

const STATUS_CFG = {
  "scheduled": { badge: "badge-info", label: "Scheduled", icon: "📅" },
  "in-progress": { badge: "badge-warning", label: "In Progress", icon: "⏳" },
  "completed": { badge: "badge-success", label: "Completed", icon: "✅" },
  "cancelled": { badge: "badge-danger", label: "Cancelled", icon: "❌" },
};

export default function VisitPlanning() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState(INITIAL_VISITS);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVillage, setNewVillage] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");

  const filtered = filter === "all" ? visits : visits.filter(v =>
    filter === "completed" ? v.status === "completed" : v.status === "scheduled" || v.status === "in-progress"
  );

  const addVisit = () => {
    if (!newVillage || !newDate) return;
    const newV: Visit = {
      id: `v${Date.now()}`, village: newVillage, date: newDate, time: "10:00 AM",
      reason: newReason || "Routine visit", patients: 0, status: "scheduled", priority: "medium",
    };
    setVisits(prev => [newV, ...prev]);
    setShowAddForm(false);
    setNewVillage(""); setNewDate(""); setNewReason("");
  };

  return (
    <div className="min-h-full bg-hs-bg">
      <div className="sticky top-0 z-10 bg-white border-b border-hs-border px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-icon border-0">
          <svg className="w-5 h-5 text-hs-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-hs-text">Visit Planning</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary text-xs py-2 px-3">+ Add Visit</button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Add Visit form */}
        {showAddForm && (
          <div className="hs-card animate-scale-in space-y-3">
            <h3 className="text-base font-bold text-hs-text">New Village Visit</h3>
            <div>
              <label className="text-xs font-semibold text-hs-text-secondary">Village name *</label>
              <input value={newVillage} onChange={e => setNewVillage(e.target.value)}
                placeholder="e.g., Hingoli" className="hs-input w-full mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-hs-text-secondary">Visit date *</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="hs-input w-full mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-hs-text-secondary">Reason / Purpose</label>
              <input value={newReason} onChange={e => setNewReason(e.target.value)}
                placeholder="e.g., Fever follow-up" className="hs-input w-full mt-1" />
            </div>
            <div className="flex gap-2">
              <button onClick={addVisit} className="btn-primary flex-1">Save Visit</button>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "This Week", val: visits.filter(v => v.status !== "completed" && v.status !== "cancelled").length, color: "text-hs-blue" },
            { label: "Total Patients", val: visits.reduce((s, v) => s + v.patients, 0), color: "text-hs-green" },
            { label: "Completed", val: visits.filter(v => v.status === "completed").length, color: "text-hs-text" },
          ].map(s => (
            <div key={s.label} className="hs-card-sm text-center">
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-hs-text-secondary mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {(["all", "scheduled", "completed"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border min-h-[44px] capitalize
                ${filter === f ? "bg-hs-blue text-white border-hs-blue" : "bg-white text-hs-text-secondary border-hs-border"}`}>
              {f === "all" ? "All Visits" : f === "scheduled" ? "📅 Upcoming" : "✅ Completed"}
            </button>
          ))}
        </div>

        {/* Visit cards */}
        <div className="space-y-3">
          {filtered.map(v => {
            const cfg = STATUS_CFG[v.status];
            return (
              <div key={v.id} className={`hs-card border-l-4 ${v.priority === "high" ? "border-hs-red" : v.priority === "medium" ? "border-hs-yellow" : "border-hs-green"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: v.priority === "high" ? "#DC2626" : v.priority === "medium" ? "#F59E0B" : "#10B981" }} />
                    <h3 className="text-base font-bold text-hs-text">{v.village}</h3>
                  </div>
                  <span className={`${cfg.badge} text-xs`}>{cfg.icon} {cfg.label}</span>
                </div>

                <p className="text-sm text-hs-text mt-2">{v.reason}</p>

                <div className="flex gap-4 mt-3 text-xs text-hs-text-secondary">
                  <span>📅 {v.date}</span>
                  <span>⏰ {v.time}</span>
                  {v.patients > 0 && <span>👥 {v.patients} patients</span>}
                  <div className="ml-auto">
                    <ReadAloudButton text={`Visit to ${v.village} on ${v.date} at ${v.time}. Reason: ${v.reason}. ${v.patients > 0 ? `${v.patients} patients expected.` : ""}`} />
                  </div>
                </div>

                {(v.status === "scheduled" || v.status === "in-progress") && (
                  <div className="flex gap-2 mt-3">
                    <button className="btn-primary text-xs py-2 flex-1">🧭 Navigate</button>
                    <button className="btn-secondary text-xs py-2 flex-1">⬇️ Download Data</button>
                    {v.status !== "in-progress" &&
                      <button onClick={() => setVisits(prev => prev.map(x => x.id === v.id ? { ...x, status: "in-progress" as const } : x))}
                        className="btn-secondary text-xs py-2 flex-1">▶ Start</button>
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}


