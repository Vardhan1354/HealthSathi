import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ROLE_KEY = "role";

type ModuleItem = {
  path: string;
  labelKey: string;
  icon: string;
  end?: boolean;
};

export default function Sidebar() {
  const { t } = useTranslation();
  const role = localStorage.getItem(ROLE_KEY);

  const PATIENT_MODULES: ModuleItem[] = [
    { path: "/patient/health-library",   icon: "📚", labelKey: "healthLibrary" },
    { path: "/patient/symptom-checker",  icon: "🤒", labelKey: "symptomChecker" },
    { path: "/patient/medicine-scanner", icon: "📸", labelKey: "scanMedicine" },
    { path: "/patient/prescription",     icon: "📋", labelKey: "prescriptionReader" },
    { path: "/patient/lab-reports",      icon: "🩸", labelKey: "labReports" },
    { path: "/patient/interaction",      icon: "⚠️", labelKey: "interactionChecker" },
    { path: "/patient/counterfeit",      icon: "🔍", labelKey: "counterfeitDetection" },
  ];

  const DOCTOR_MODULES: ModuleItem[] = [
    { path: "/dashboard",       icon: "🩺", labelKey: "doctorDashboard", end: true },
    { path: "/heatmap",         icon: "🗺️", labelKey: "heatMap" },
    { path: "/alerts",          icon: "🔔", labelKey: "alerts" },
    { path: "/visit-planning",  icon: "📅", labelKey: "visitPlanning" },
  ];

  function NavItem({
    to,
    end = false,
    icon,
    children,
  }: {
    to: string;
    end?: boolean;
    icon: string;
    children: React.ReactNode;
  }) {
    return (
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-colors ${
            isActive
              ? "bg-navy-light text-white font-semibold"
              : "text-slate-300 hover:bg-navy-light/60 hover:text-white"
          }`
        }
      >
        <span className="text-base flex-shrink-0">{icon}</span>
        <span className="truncate">{children}</span>
      </NavLink>
    );
  }

  return (
    <aside className="w-[260px] flex-shrink-0 h-full bg-navy flex flex-col overflow-hidden">
      <nav className="flex-1 overflow-y-auto py-4">
        
        {/* Patient Section */}
        {role === "patient" && (
          <>
            <div className="px-4 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("patientModules")}
              </h2>
            </div>

            <ul className="space-y-0.5 px-2">
              {PATIENT_MODULES.map((item) => (
                <li key={item.path}>
                  <NavItem to={item.path} end={item.end ?? false} icon={item.icon}>
                    {t(item.labelKey)}
                  </NavItem>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Doctor Section */}
        {role === "doctor" && (
          <>
            <div className="px-4 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("doctorModules")}
              </h2>
            </div>

            <ul className="space-y-0.5 px-2">
              {DOCTOR_MODULES.map((item) => (
                <li key={item.path}>
                  <NavItem to={item.path} end={item.end ?? false} icon={item.icon}>
                    {t(item.labelKey)}
                  </NavItem>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}