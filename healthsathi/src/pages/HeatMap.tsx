import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import ReadAloudButton from "../components/ReadAloudButton";

/* ─── mock village data with real lat/lng for Maharashtra ─── */
interface Village {
  id: string;
  name: string;
  lat: number;
  lng: number;
  level: "high" | "medium" | "low";
  cases: number;
  diagnosis: string;
  action: string;
}

const VILLAGES: Village[] = [
  { id: "v1", name: "Kolwadi", lat: 19.18, lng: 77.30, level: "high", cases: 18, diagnosis: "Acute respiratory infection cluster — likely viral. 18 fever cases in 4 days.", action: "Deploy mobile clinic Thursday. Send ORS packets + Paracetamol. Test 3 samples." },
  { id: "v2", name: "Hingoli", lat: 19.72, lng: 77.15, level: "high", cases: 12, diagnosis: "Suspected dengue outbreak. 12 cases with high fever + rash.", action: "Mosquito fogging needed. Refer 3 severe cases to district hospital." },
  { id: "v3", name: "Shegaon", lat: 20.79, lng: 76.70, level: "medium", cases: 7, diagnosis: "GI infection cluster — likely contaminated water source.", action: "Water testing required. Distribute ORS + chlorine tablets." },
  { id: "v4", name: "Sonpeth", lat: 19.01, lng: 76.47, level: "medium", cases: 5, diagnosis: "Malaria-like symptoms in 5 patients near river area.", action: "RDT testing kit needed. Distribute anti-malarial if confirmed." },
  { id: "v5", name: "Nanded", lat: 19.16, lng: 77.31, level: "low", cases: 2, diagnosis: "2 hypertension follow-ups needed. Chronic disease management.", action: "Schedule routine visit next week. Bring BP medications." },
  { id: "v6", name: "Parbhani", lat: 19.27, lng: 76.78, level: "low", cases: 3, diagnosis: "3 post-delivery mother check-ups pending.", action: "Priority home visits this week. Iron + folic acid supplements." },
];

const COLOR = { high: "#DC2626", medium: "#F59E0B", low: "#10B981" };
const BG_COLOR = { high: "bg-hs-red-light border-hs-red/20", medium: "bg-hs-yellow-light border-hs-yellow/20", low: "bg-hs-green-light border-hs-green/20" };
const TEXT_COLOR = { high: "text-hs-red", medium: "text-hs-yellow-dark", low: "text-hs-green-dark" };
const BADGE = { high: "badge-danger", medium: "badge-warning", low: "badge-success" };

// Center of Maharashtra
const MAP_CENTER: [number, number] = [19.5, 77.0];
const MAP_ZOOM = 8;

export default function HeatMap() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Village | null>(null);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const filtered = filter === "all" ? VILLAGES : VILLAGES.filter(v => v.level === filter);

  return (
    <div className="min-h-full bg-hs-bg">
      {/* Header */}
      <div className="sticky top-0 z-[1000] bg-white border-b border-hs-border px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-icon border-0 hover:bg-hs-bg">
          <svg className="w-5 h-5 text-hs-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-hs-text">Disease Heat Map</h1>
        <span className="badge-danger text-xs">{VILLAGES.filter(v => v.level === "high").length} Alert</span>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">

        {/* Filter pills */}
        <div className="flex gap-2">
          {(["all", "high", "medium", "low"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors min-h-[44px] capitalize
                ${filter === f ? "bg-hs-blue text-white border-hs-blue" : "bg-white text-hs-text-secondary border-hs-border"}`}>
              {f === "all" ? "🗺️ All" : f === "high" ? "🔴 High" : f === "medium" ? "🟡 Medium" : "🟢 Low"}
            </button>
          ))}
        </div>

        {/* Leaflet Map — interactive, draggable, zoomable */}
        <div className="hs-card p-0 overflow-hidden rounded-2xl" style={{ height: "350px" }}>
          <MapContainer
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map(v => (
              <CircleMarker
                key={v.id}
                center={[v.lat, v.lng]}
                radius={v.level === "high" ? 18 : v.level === "medium" ? 14 : 10}
                pathOptions={{
                  color: COLOR[v.level],
                  fillColor: COLOR[v.level],
                  fillOpacity: 0.5,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => setSelected(v),
                }}
              >
                <Popup>
                  <div className="text-center">
                    <strong>{v.name}</strong><br />
                    <span style={{ color: COLOR[v.level] }}>{v.cases} cases — {v.level.toUpperCase()} risk</span><br />
                    <span className="text-xs">{v.diagnosis.split("—")[0]}</span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div className="flex gap-4 text-xs text-hs-text-secondary">
          <span className="flex items-center gap-1">🔴 High risk</span>
          <span className="flex items-center gap-1">🟡 Medium</span>
          <span className="flex items-center gap-1">🟢 Low</span>
          <span className="ml-auto">Tap a circle for details</span>
        </div>

        {/* Bottom sheet / detail card */}
        {selected ? (
          <div className={`hs-card border ${BG_COLOR[selected.level]} animate-scale-in`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-hs-text">{selected.name}</h2>
                <span className={`${BADGE[selected.level]} text-xs mt-1 inline-block`}>
                  {selected.cases} cases · {selected.level.toUpperCase()} risk
                </span>
              </div>
              <div className="flex items-center gap-1">
                <ReadAloudButton text={`${selected.name}. ${selected.diagnosis} Recommended action: ${selected.action}`} />
                <button onClick={() => setSelected(null)} className="btn-icon border-0 text-hs-text-secondary">✕</button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-hs-text-secondary uppercase mb-1">Diagnosis</p>
                <p className="text-sm text-hs-text">{selected.diagnosis}</p>
              </div>
              <div className={`rounded-xl p-3 ${selected.level === "high" ? "bg-hs-red-light" : "bg-hs-yellow-light"}`}>
                <p className="text-xs font-semibold text-hs-text-secondary uppercase mb-1">Recommended Action</p>
                <p className="text-sm text-hs-text">{selected.action}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <button className="btn-primary text-xs py-3">🧭 Navigate</button>
              <button className="btn-secondary text-xs py-3">⬇️ Download</button>
              <button className="btn-secondary text-xs py-3">⏰ Remind</button>
            </div>
          </div>
        ) : (
          /* Village list */
          <div className="space-y-2">
            <h2 className="hs-section-title">Village Summary</h2>
            {filtered.map(v => (
              <button key={v.id} onClick={() => setSelected(v)}
                className="w-full hs-card text-left flex items-center gap-3 min-h-[56px]">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLOR[v.level] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-hs-text">{v.name}</p>
                  <p className="text-xs text-hs-text-secondary truncate">{v.diagnosis.split("—")[0]}</p>
                </div>
                <span className={`text-sm font-bold ${TEXT_COLOR[v.level]}`}>{v.cases}</span>
                <svg className="w-4 h-4 text-hs-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
