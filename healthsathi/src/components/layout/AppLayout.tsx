import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "./Header";

interface ModuleItem {
  path: string;
  labelKey: string;
  color: string;
  icon: React.ReactNode;
  end?: boolean;
}

const PATIENT_MODULES: ModuleItem[] = [
  {
    path: "/patient/profile", labelKey: "profile",
    color: "bg-indigo-100 text-indigo-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    path: "/patient/health-library", labelKey: "healthLibrary",
    color: "bg-emerald-100 text-emerald-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  },
  {
    path: "/patient/symptom-checker", labelKey: "symptomChecker",
    color: "bg-pink-100 text-pink-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  },
  {
    path: "/patient/medicine-scanner", labelKey: "scanMedicine",
    color: "bg-teal-100 text-teal-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>,
  },
  {
    path: "/patient/prescription", labelKey: "prescriptionReader",
    color: "bg-blue-100 text-blue-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    path: "/patient/lab-reports", labelKey: "labReports",
    color: "bg-cyan-100 text-cyan-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  },
  {
    path: "/patient/interaction", labelKey: "interactionChecker",
    color: "bg-amber-100 text-amber-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  },
  {
    path: "/patient/counterfeit", labelKey: "counterfeitDetection",
    color: "bg-rose-100 text-rose-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
];

const DOCTOR_MODULES: ModuleItem[] = [
  {
    path: "/doctor", labelKey: "doctorDashboard", end: true,
    color: "bg-violet-100 text-violet-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    path: "/doctor/profile", labelKey: "profile",
    color: "bg-indigo-100 text-indigo-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    path: "/doctor/heatmap", labelKey: "heatMap",
    color: "bg-orange-100 text-orange-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  },
  {
    path: "/doctor/alerts", labelKey: "alerts",
    color: "bg-rose-100 text-rose-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  },
  {
    path: "/doctor/visit-planning", labelKey: "visitPlanning",
    color: "bg-teal-100 text-teal-600",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
];

function NavItem({
  to, end = false, icon, color, onClick, children,
}: {
  to: string; end?: boolean; icon?: React.ReactNode; color?: string; onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <NavLink to={to} end={end} onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-150 ${
          isActive
            ? "bg-teal-accent/10 text-teal-accent font-semibold"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`
      }>
      {icon && (
        <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg ${color ?? "bg-slate-100 text-slate-500"}`}>
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const role = localStorage.getItem("userRole");
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const name = localStorage.getItem(role === "doctor" ? "doctorName" : "patientName");
  const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : (role === "doctor" ? "DR" : "PT");

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("doctorName");
    localStorage.removeItem("patientName");
    navigate("/");
  };

  const modules = role === "doctor" ? DOCTOR_MODULES : PATIENT_MODULES;

  // Bottom nav: first 5 items for patient, all doctor items
  const bottomNavItems = modules.slice(0, 5);

  const SidebarContent = () => (
    <>
      {/* User card */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-teal flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{name || (role === "doctor" ? "Doctor" : "Patient")}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-400 capitalize">{role} · Active</span>
            </div>
          </div>
        </div>
      </div>
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-3 mb-2 text-xs font-medium uppercase tracking-widest text-slate-400">
          {role === "doctor" ? t("doctorTools") : t("patientTools")}
        </p>
        <ul className="space-y-0.5">
          {modules.map((item) => (
            <li key={item.path}>
              <NavItem to={item.path} end={item.end ?? false} icon={item.icon} color={item.color}
                onClick={() => setSidebarOpen(false)}>
                {t(item.labelKey)}
              </NavItem>
            </li>
          ))}
        </ul>
      </nav>
      {/* Logout */}
      <div className="p-3 border-t border-slate-100">
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-150">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── DESKTOP SIDEBAR (lg+) ── */}
        <aside className="hidden lg:flex w-[248px] flex-shrink-0 h-full bg-white border-r border-slate-200 flex-col overflow-hidden">
          <SidebarContent />
        </aside>

        {/* ── MOBILE SIDEBAR OVERLAY ── */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            {/* Drawer */}
            <aside className="relative z-50 w-72 max-w-[85vw] h-full bg-white flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-bold text-slate-700">Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto bg-slate-50 pb-16 lg:pb-0">
          {/* Mobile top bar with hamburger */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-100 sticky top-0 z-30">
            <button onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-700 truncate">
              {t(modules.find(m => location.pathname.startsWith(m.path) && !m.end || location.pathname === m.path)?.labelKey ?? (role === "doctor" ? "doctorDashboard" : "patientDashboard"))}
            </span>
            <div className="ml-auto w-8 h-8 rounded-xl bg-gradient-teal flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {initials}
            </div>
          </div>

          <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 flex items-stretch safe-bottom">
        {bottomNavItems.map((item) => {
          const isActive = item.end
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
          return (
            <NavLink key={item.path} to={item.path} end={item.end}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 text-xs font-medium transition-colors gap-0.5 min-w-0
                ${isActive ? "text-teal-accent" : "text-slate-400 hover:text-slate-600"}`}>
              <span className={`w-6 h-6 flex items-center justify-center rounded-lg ${isActive ? item.color : ""}`}>
                {item.icon}
              </span>
              <span className="truncate w-full text-center leading-none" style={{ fontSize: "10px" }}>{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
        {/* "More" button to open full sidebar */}
        <button onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-2 px-1 text-xs font-medium text-slate-400 hover:text-slate-600 gap-0.5">
          <span className="w-6 h-6 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </span>
          <span className="leading-none" style={{ fontSize: "10px" }}>More</span>
        </button>
      </nav>
    </div>
  );
}
