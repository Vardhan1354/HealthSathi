import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReadAloudButton from "../components/ReadAloudButton";

/* ─── data (keys, not hardcoded strings) ─── */
const MEDICINE_TOOLS = [
  { to: "/patient/medicine-scanner",  icon: "📸", bg: "bg-hs-blue-light",   titleKey: "scanMedicineTitle",       subtitleKey: "scanMedicineSubtitle" },
  { to: "/patient/prescription",       icon: "📋", bg: "bg-hs-blue-light",   titleKey: "readPrescriptionTitle",   subtitleKey: "readPrescriptionSubtitle" },
  { to: "/patient/interaction",        icon: "⚠️", bg: "bg-hs-yellow-light", titleKey: "checkInteractionsTitle",  subtitleKey: "checkInteractionsSubtitle" },
  { to: "/patient/counterfeit",        icon: "🔍", bg: "bg-hs-blue-light",   titleKey: "counterfeitCheckTitle",   subtitleKey: "counterfeitCheckSubtitle" },
];

const HEALTH_GUIDANCE = [
  { to: "/patient/symptom-checker", icon: "🤒", bg: "bg-hs-green-light",  titleKey: "symptomCheckerTitle",  subtitleKey: "symptomCheckerSubtitle" },
  { to: "/patient/lab-reports",     icon: "🩸", bg: "bg-hs-blue-light",   titleKey: "explainReportTitle",   subtitleKey: "explainReportSubtitle" },
  { to: "/patient/dashboard",       icon: "👨‍⚕️", bg: "bg-hs-green-light", titleKey: "requestDoctorTitle",   subtitleKey: "requestDoctorSubtitle" },
];

/* ─── feature card ─── */
function FeatureCard({ to, icon, bg, titleKey, subtitleKey }: {
  to: string; icon: string; bg: string; titleKey: string; subtitleKey: string;
}) {
  const { t } = useTranslation();
  return (
    <Link to={to} className="feature-card group">
      <div className={`feature-card-icon ${bg}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold text-hs-text leading-snug group-hover:text-hs-blue transition-colors">{t(titleKey)}</p>
        <p className="text-sm text-hs-text-secondary mt-0.5 leading-snug">{t(subtitleKey)}</p>
      </div>
      <svg className="w-4 h-4 text-hs-border flex-shrink-0 group-hover:text-hs-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/* ─── skeleton card ─── */
function SkeletonCard() {
  return (
    <div className="feature-card">
      <div className="w-12 h-12 rounded-xl skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 skeleton" />
        <div className="h-3 w-4/5 skeleton" />
      </div>
    </div>
  );
}

/* ─── main ─── */
export default function PatientDashboard() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [syncInfo] = useState({ lastSync: "2 hours ago", queued: 0 });
  const name = localStorage.getItem("patientName");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { clearTimeout(timer); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? t("goodMorning") : h < 17 ? t("goodAfternoon") : t("goodEvening");
  })();

  return (
    <div className="min-h-full bg-hs-bg">

      {/* Offline banner */}
      {!isOnline && (
        <div className="offline-banner sticky top-0 z-20">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18" />
          </svg>
          <span>{ t("workingOffline") }</span>
          {syncInfo.queued > 0 && (
            <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs">{syncInfo.queued} queued</span>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6 animate-fade-in">

        {/* Greeting */}
        <div className="bg-hs-blue rounded-2xl px-5 py-5 text-white shadow-[0_4px_16px_rgba(37,99,235,0.30)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm text-blue-200">{greeting}{name ? `, ${name.split(" ")[0]}` : ""}</p>
              <h1 className="text-2xl font-bold mt-0.5">{t("stayHealthyToday")}</h1>
              <p className="text-sm text-blue-100 mt-1">
                {isOnline ? t("allToolsOnline") : t("allToolsOffline")}
              </p>
            </div>
            <ReadAloudButton
              text={`${greeting}${name ? `, ${name.split(" ")[0]}` : ""}. ${t("stayHealthyToday")}. ${isOnline ? t("allToolsOnline") : t("allToolsOffline")}`}
              className="flex-shrink-0 mt-1"
            />
          </div>
        </div>

        {/* ── Featured: Health Library ── */}
        <Link to="/patient/health-library" className="block rounded-2xl overflow-hidden shadow-md">
          <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 px-5 py-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide mb-1">{t("featuredLibrary")}</p>
                <p className="text-base font-bold leading-snug">{t("featuredLibrarySubtitle")}</p>
              </div>
              <span className="text-4xl flex-shrink-0">📚</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors px-4 py-1.5 rounded-full text-sm font-semibold">
              {t("startExploring")}
            </div>
          </div>
        </Link>

        {/* ── MEDICINE TOOLS ── */}
        <div>
          <p className="hs-section-title">{t("medicineTools")}</p>
          <div className="space-y-3">
            {loading
              ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
              : MEDICINE_TOOLS.map((f) => <FeatureCard key={f.to} {...f} />)
            }
          </div>
        </div>

        {/* ── HEALTH GUIDANCE ── */}
        <div>
          <p className="hs-section-title">{t("healthGuidance")}</p>
          <div className="space-y-3">
            {loading
              ? Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)
              : HEALTH_GUIDANCE.map((f) => <FeatureCard key={f.to} {...f} />)
            }
          </div>
        </div>

        {/* ── Sync footer ── */}
        <div className="hs-card-sm flex items-center justify-between text-sm text-hs-text-secondary">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-hs-green" : "bg-hs-yellow animate-pulse"}`} />
            {isOnline ? `${t("lastSynced")}: ${syncInfo.lastSync}` : t("offlineSync")}
          </div>
          {syncInfo.queued > 0 && (
            <span className="badge-warning">{syncInfo.queued} items queued</span>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-hs-text-secondary text-center pb-2 leading-relaxed">
          {t("forGuidanceOnly")}
        </p>

      </div>
    </div>
  );
}
