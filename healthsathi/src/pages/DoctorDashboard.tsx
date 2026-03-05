import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard } from "../services/api";
import type { DashboardResponse } from "../services/api";
import ReadAloudButton from "../components/ReadAloudButton";
import { getSyncStatus, forceSyncNow, onSyncStatusChange, type SyncStatus } from "../services/syncService";
// Storage imports removed - using local state

/* ─── mock data ─── */
const PATIENT_REQUESTS = [
  { id: "P001", name: "Sunita Devi", age: 42, village: "Kolwadi", symptom: "High fever 104°F — 3 days", priority: "urgent" as const, since: "4h ago" },
  { id: "P002", name: "Ramesh Yadav", age: 67, village: "Hingoli", symptom: "Chest pain, breathlessness", priority: "urgent" as const, since: "1h ago" },
  { id: "P003", name: "Baby Lata", age: 2, village: "Nanded", symptom: "Diarrhoea + vomiting", priority: "medium" as const, since: "6h ago" },
  { id: "P004", name: "Priya Waghmare", age: 28, village: "Sonpeth", symptom: "Rash on arms since 2 days", priority: "medium" as const, since: "12h ago" },
  { id: "P005", name: "Kisan Patil", age: 55, village: "Shegaon", symptom: "Follow-up — BP medication", priority: "low" as const, since: "1d ago" },
];

const TREND_DATA = [
  { label: "Mon", infections: 8, fever: 5 },
  { label: "Tue", infections: 11, fever: 7 },
  { label: "Wed", infections: 14, fever: 9 },
  { label: "Thu", infections: 18, fever: 12 },
  { label: "Fri", infections: 24, fever: 15 },
  { label: "Sat", infections: 19, fever: 11 },
  { label: "Sun", infections: 22, fever: 14 },
];

const MAX_TREND = 24;

const QUICK_ACTIONS = [
  { label: "Heat Map", icon: "🗺️", path: "/doctor/heatmap", color: "bg-hs-yellow-light border-hs-yellow/30 text-hs-yellow-dark" },
  { label: "Plan Visits", icon: "📅", path: "/doctor/visit-planning", color: "bg-hs-blue-light border-hs-blue/30 text-hs-blue" },
  { label: "All Alerts", icon: "🔔", path: "/doctor/alerts", color: "bg-hs-red-light border-hs-red/20 text-hs-red" },
];

/* ─── Priority badge ─── */
function PriorityDot({ p }: { p: "urgent" | "medium" | "low" }) {
  const cfg = { urgent: "bg-hs-red", medium: "bg-hs-yellow", low: "bg-hs-green" };
  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg[p]}`} />;
}

/* ─── Bar chart ─── */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="h-16 w-4 bg-hs-bg rounded-t-lg flex flex-col justify-end">
      <div className={`${color} rounded-t-lg transition-all`} style={{ height: `${pct}%` }} />
    </div>
  );
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [liveDash, setLiveDash] = useState<DashboardResponse | null>(null);
  const doctorId = localStorage.getItem("doctorId") || "";
  const doctorName = localStorage.getItem("doctorName") || "Doctor";

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!doctorId || !import.meta.env.VITE_API_BASE_URL) return;
    getDashboard(doctorId)
      .then(setLiveDash)
      .catch((err: Error) => console.warn("[Dashboard] API error, using mock:", err.message));
  }, [doctorId]);

  // Try fetching aggregated bridge data directly (works even without VITE_API_BASE_URL since backend is proxied)
  useEffect(() => {
    fetch("/api/dashboard/aggregate")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("aggregate failed")))
      .then(agg => {
        if (agg && agg.last24hCount > 0) {
          // Convert aggregate data into DashboardResponse-like shape
          setLiveDash({
            doctor: { id: doctorId, name: doctorName, villages: Object.keys(agg.regionCounts || {}) },
            requests: {
              urgent: (agg.patientRequests || []).filter((r: any) => r.priority === "urgent"),
              medium: (agg.patientRequests || []).filter((r: any) => r.priority === "medium"),
              low:    (agg.patientRequests || []).filter((r: any) => r.priority === "low"),
              total:  (agg.patientRequests || []).length,
            },
            trends: {
              period: "7d",
              daily: (agg.dailyTrend || []).map((d: any) => ({
                date: d.date,
                scans: d.medicines + d.symptoms,
                counterfeits: d.counterfeits,
              })),
              topSymptoms: agg.topSymptoms || [],
              totalScans: agg.last24hCount || 0,
            },
            alerts: agg.alerts || [],
            stats: agg.stats || { medicineScans: 0, counterfeitsFound: 0, prescriptionsRead: 0 },
            lastUpdated: agg.lastUpdated || Date.now(),
          } as DashboardResponse);
        }
      })
      .catch(() => { /* aggregate not available, use mock or getDashboard data */ });
  }, [doctorId, doctorName]);

  // Real-time sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => {
    const unsub = onSyncStatusChange(setSyncStatus);
    return unsub;
  }, []);

  // Use live data if available, else fall back to mock
  const patientRequests = liveDash
    ? [...(liveDash.requests.urgent as typeof PATIENT_REQUESTS), ...(liveDash.requests.medium as typeof PATIENT_REQUESTS)]
    : PATIENT_REQUESTS;
  const trendData    = liveDash ? liveDash.trends.daily.map(d => ({ label: d.date.slice(5), infections: d.scans, fever: d.counterfeits })) : TREND_DATA;
  const liveStats    = liveDash?.stats;
  const urgentCount  = liveDash ? liveDash.requests.urgent.length : PATIENT_REQUESTS.filter(r => r.priority === "urgent").length;

  return (
    <div className="min-h-full bg-hs-bg">
      {!isOnline && (
        <div className="offline-banner">
          📵 You're offline — showing last synced data &nbsp;·&nbsp; <span className="font-normal">Changes will sync when connected</span>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

        {/* Greeting */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-hs-text">Welcome, {doctorName} 👋</h1>
            <p className="text-sm text-hs-text-secondary mt-0.5">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <ReadAloudButton text={`Welcome ${doctorName}. Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}. You have ${urgentCount} urgent patient request${urgentCount !== 1 ? "s" : ""}.`} />
        </div>

        {/* Alert banner if urgent requests */}
        {urgentCount > 0 && (
          <div className="bg-hs-red-light border border-hs-red/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="text-sm font-bold text-hs-red">{urgentCount} urgent patient request{urgentCount > 1 ? "s" : ""} need attention</p>
              <p className="text-xs text-hs-text-secondary">Review below and respond promptly</p>
            </div>
          </div>
        )}

        {/* ── PANEL 1: Patient Requests ── */}
        <div className="hs-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="hs-section-title">Patient Requests</h2>
            <span className="badge-danger text-xs">{urgentCount} urgent</span>
          </div>

          <div className="space-y-2">
            {patientRequests.map((p) => (
              <div key={p.id} className="flex items-start gap-3 py-3 border-b border-hs-border last:border-0">
                <PriorityDot p={p.priority} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-hs-text">{p.name}, {p.age}</p>
                    <span className="text-xs text-hs-text-secondary flex-shrink-0">{p.since}</span>
                  </div>
                  <p className="text-xs text-hs-text-secondary">{p.village}</p>
                  <p className="text-sm text-hs-text mt-0.5">{p.symptom}</p>
                </div>
                <button className="btn-icon flex-shrink-0 border-hs-blue/20 text-hs-blue" title="Respond">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-1 flex gap-2 text-xs text-hs-text-secondary pt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-hs-red" />Urgent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-hs-yellow" />Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-hs-green" />Low</span>
          </div>
        </div>

        {/* ── PANEL 2: Health Trends ── */}
        <div className="hs-card">
          <h2 className="hs-section-title mb-3">Health Trends — This Week</h2>

          {/* Outbreak alert */}
          <div className="bg-hs-yellow-light border border-hs-yellow/20 rounded-xl p-3 mb-4 flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-bold text-hs-yellow-dark">Potential Outbreak Alert</p>
              <p className="text-xs text-hs-text-secondary">Respiratory infections up 40% vs last week. Prepare cold chain supplies.</p>
            </div>
          </div>

          {/* Chart */}
          <div className="flex items-end justify-between gap-1 mt-2">
            {trendData.map((d) => (
              <div key={d.label} className="flex flex-col items-center gap-1 flex-1">
                <div className="flex items-end gap-0.5">
                  <MiniBar value={d.infections} max={MAX_TREND} color="bg-hs-red" />
                  <MiniBar value={d.fever} max={MAX_TREND} color="bg-hs-yellow" />
                </div>
                <span className="text-xs text-hs-text-secondary">{d.label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-3 text-xs text-hs-text-secondary">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-hs-red" />Infections</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-hs-yellow" />Fever</span>
          </div>
        </div>

        {/* ── PANELS 3 & 4: 2-col grid ── */}
        <div className="grid grid-cols-2 gap-4">
          {/* PANEL 3: Medicine Queries */}
          <div className="hs-card">
            <h2 className="text-sm font-bold text-hs-text mb-3">Medicine Queries</h2>
            {[
              { label: "Scans today", val: liveStats?.medicineScans ?? 47, color: "text-hs-blue" },
              { label: "Counterfeits", val: liveStats?.counterfeitsFound ?? 3, color: "text-hs-red" },
              { label: "Prescriptions", val: liveStats?.prescriptionsRead ?? 12, color: "text-hs-green" },
            ].map((s) => (
              <div key={s.label} className="flex justify-between items-center py-2 border-b border-hs-border last:border-0">
                <span className="text-xs text-hs-text-secondary">{s.label}</span>
                <span className={`text-base font-bold ${s.color}`}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* PANEL 4: Sync Status */}
          <div className="hs-card">
            <h2 className="text-sm font-bold text-hs-text mb-3">Bridge Sync</h2>
            <span className={`badge-${isOnline ? "success" : "warning"} text-xs mb-3 inline-block`}>
              {isOnline ? "🟢 Online" : "🟡 Offline"}
            </span>
            {[
              { label: "Last sync", val: syncStatus.lastSyncTime ? formatSyncTime(syncStatus.lastSyncTime) : "Never" },
              { label: "Queue", val: `${syncStatus.queueCount} items` },
              { label: "Status", val: syncStatus.isSyncing ? "Syncing..." : (syncStatus.lastSyncSuccess ? "Ready" : "Error") },
            ].map((s) => (
              <div key={s.label} className="flex justify-between items-center py-1.5 border-b border-hs-border last:border-0">
                <span className="text-xs text-hs-text-secondary">{s.label}</span>
                <span className="text-xs font-semibold text-hs-text">{s.val}</span>
              </div>
            ))}
            <button
              className="btn-secondary text-xs w-full mt-2"
              onClick={() => forceSyncNow()}
              disabled={syncStatus.isSyncing || !isOnline}
            >
              {syncStatus.isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>

        {/* ── Quick action buttons ── */}
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border font-semibold text-xs min-h-[44px] ${a.color}`}
            >
              <span className="text-2xl">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

function formatSyncTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
