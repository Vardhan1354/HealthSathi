import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getProfile,
  migrateFromLegacy,
  type UserProfile,
} from "../services/profileStorage";
import {
  getSavedScans,
  deleteScan,
  type SavedScan,
} from "../services/storage";

// Map storage types to display types
type DisplayType = "prescription" | "labReport" | "medicineScan" | "symptomCheck" | "counterfeit" | "interaction";

const TYPE_LABELS: Record<DisplayType, string> = {
  prescription: "Prescription",
  labReport: "Lab Report",
  medicineScan: "Medicine Scan",
  symptomCheck: "Symptom Check",
  counterfeit: "Counterfeit Check",
  interaction: "Interaction Check",
};

const TYPE_ICONS: Record<DisplayType, string> = {
  prescription: "📋",
  labReport: "🔬",
  medicineScan: "💊",
  symptomCheck: "🩺",
  counterfeit: "🛡️",
  interaction: "⚠️",
};

const TYPE_COLORS: Record<DisplayType, string> = {
  prescription: "bg-blue-100 text-blue-600",
  labReport: "bg-cyan-100 text-cyan-600",
  medicineScan: "bg-teal-100 text-teal-600",
  symptomCheck: "bg-pink-100 text-pink-600",
  counterfeit: "bg-amber-100 text-amber-600",
  interaction: "bg-orange-100 text-orange-600",
};

// Map storage.ts type to display type
function mapScanType(type: SavedScan["type"]): DisplayType {
  switch (type) {
    case "medicine": return "medicineScan";
    case "prescription": return "prescription";
    case "lab-report": return "labReport";
    case "counterfeit": return "counterfeit";
    case "interaction": return "interaction";
    case "symptom": return "symptomCheck";
    default: return "medicineScan";
  }
}

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [activeTab, setActiveTab] = useState<"profile" | "saved">("profile");
  const [filter, setFilter] = useState<DisplayType | "all">("all");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    migrateFromLegacy();
    setProfile(getProfile());
    setSavedScans(getSavedScans());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm(t("confirmDelete", "Are you sure you want to delete this item?"))) {
      deleteScan(id);
      setSavedScans(getSavedScans());
    }
  };

  const filteredItems = filter === "all" 
    ? savedScans 
    : savedScans.filter(scan => mapScanType(scan.type) === filter);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!profile) {
    return (
      <div className="min-h-full bg-hs-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-700 mb-2">{t("noProfile", "No Profile Found")}</h2>
          <p className="text-sm text-slate-500 mb-4">{t("pleaseRegister", "Please register or login to view your profile")}</p>
          <button onClick={() => navigate("/")} className="btn-primary px-6 py-2">
            {t("goHome", "Go to Home")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-hs-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-4 pt-6 pb-16">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-teal-600">
              {profile.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              {profile.type === "doctor" ? "Dr. " : ""}{profile.fullName}
            </h1>
            <p className="text-teal-100 text-sm">
              {profile.type === "patient" ? t("patient", "Patient") : t("doctor", "Doctor")}
              {profile.type === "doctor" && ` • ${(profile as typeof profile & { type: "doctor" }).specialization}`}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="px-4 -mt-10">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === "profile"
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-slate-500"
              }`}
            >
              {t("profileInfo", "Profile Info")}
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === "saved"
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-slate-500"
              }`}
            >
              {t("savedItems", "Saved Items")} ({savedScans.length})
            </button>
          </div>

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="p-4 space-y-4">
              {profile.type === "patient" ? (
                <>
                  <ProfileField label={t("fullName", "Full Name")} value={profile.fullName} />
                  <ProfileField label={t("mobile", "Mobile")} value={profile.mobile} />
                  {profile.email && <ProfileField label={t("email", "Email")} value={profile.email} />}
                  {profile.username && <ProfileField label={t("username", "Username")} value={profile.username} />}
                  <ProfileField label={t("age", "Age")} value={profile.age ? `${profile.age} years` : "-"} />
                  <ProfileField label={t("gender", "Gender")} value={profile.gender || "-"} />
                  {profile.village && <ProfileField label={t("village", "Village")} value={profile.village} />}
                  <ProfileField label={t("district", "District")} value={profile.district || "-"} />
                </>
              ) : (
                <>
                  <ProfileField label={t("fullName", "Full Name")} value={`Dr. ${profile.fullName}`} />
                  <ProfileField label={t("regNumber", "Registration No.")} value={profile.registrationNumber} />
                  <ProfileField label={t("specialization", "Specialization")} value={profile.specialization} />
                  <ProfileField label={t("mobile", "Mobile")} value={profile.mobile} />
                  <ProfileField label={t("hospital", "Hospital")} value={profile.hospital} />
                  <ProfileField label={t("district", "District")} value={profile.district} />
                </>
              )}
              <ProfileField 
                label={t("memberSince", "Member Since")} 
                value={formatDate(profile.createdAt)} 
              />
            </div>
          )}

          {/* Saved Items Tab */}
          {activeTab === "saved" && (
            <div className="p-4">
              {/* Filter Buttons */}
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                <FilterButton 
                  active={filter === "all"} 
                  onClick={() => setFilter("all")}
                  label={t("all", "All")}
                  count={savedScans.length}
                />
                {(["prescription", "labReport", "medicineScan", "symptomCheck", "counterfeit", "interaction"] as const).map(type => {
                  const count = savedScans.filter(s => mapScanType(s.type) === type).length;
                  if (count === 0) return null; // Hide filters with no items
                  return (
                    <FilterButton
                      key={type}
                      active={filter === type}
                      onClick={() => setFilter(type)}
                      label={TYPE_LABELS[type]}
                      count={count}
                    />
                  );
                })}
              </div>

              {/* Items List */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <p className="text-slate-500 text-sm">{t("noSavedItems", "No saved items yet")}</p>
                  <p className="text-slate-400 text-xs mt-1">{t("scanToSave", "Scan prescriptions or lab reports to save them here")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map(scan => {
                    const displayType = mapScanType(scan.type);
                    return (
                      <div key={scan.id} className="bg-slate-50 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedItem(expandedItem === scan.id ? null : scan.id)}
                          className="w-full p-3 flex items-center gap-3 text-left"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${TYPE_COLORS[displayType]}`}>
                            <span className="text-lg">{TYPE_ICONS[displayType]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-slate-800 truncate">{scan.title}</h4>
                            <p className="text-xs text-slate-500">{formatDate(scan.timestamp)}</p>
                          </div>
                          <svg 
                            className={`w-5 h-5 text-slate-400 transition-transform ${expandedItem === scan.id ? "rotate-180" : ""}`} 
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedItem === scan.id && (
                          <div className="px-3 pb-3 border-t border-slate-200">
                            {scan.summary && (
                              <div className="mt-3 p-3 bg-white rounded-lg text-xs text-slate-600 max-h-40 overflow-y-auto">
                                <p>{scan.summary}</p>
                              </div>
                            )}
                            {scan.data && typeof scan.data === "object" && "medicines" in scan.data && Array.isArray(scan.data.medicines) && (
                              <div className="mt-2 p-3 bg-white rounded-lg text-xs text-slate-600">
                                <p className="font-semibold mb-1">Medicines:</p>
                                <ul className="list-disc list-inside">
                                  {scan.data.medicines.map((med, i) => (
                                    <li key={i}>{typeof med === "string" ? med : JSON.stringify(med)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              onClick={() => handleDelete(scan.id)}
                              className="mt-3 w-full py-2 text-sm text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                            >
                              {t("delete", "Delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Padding */}
      <div className="h-6" />
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function FilterButton({ 
  active, 
  onClick, 
  label, 
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  label: string; 
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-teal-500 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label} ({count})
    </button>
  );
}
