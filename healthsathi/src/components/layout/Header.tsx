import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "EN", full: "English" },
  { code: "hi", label: "à¤¹à¤¿", full: "हिंदी" },
  { code: "mr", label: "à¤®", full: "मराठी" },
] as const;

export default function Header() {
  const { i18n } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("language", code);
    setIsDropdownOpen(false);
  };

  return (
    <header className="h-14 flex-shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-teal flex items-center justify-center shadow-glow">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-slate-900">HealthSathi</span>
          <span className="hidden sm:inline text-xs text-slate-400 font-normal">Offline Healthcare</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Online/Offline pill */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          isOnline
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
          {isOnline ? "Online" : "Offline Mode"}
        </div>

        {/* Language selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {currentLang.full}
            <svg className={`w-3 h-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
              <ul className="absolute right-0 top-full mt-1.5 w-36 py-1 bg-white border border-slate-200 rounded-xl shadow-card z-20">
                {LANGUAGES.map((lang) => (
                  <li key={lang.code}>
                    <button
                      type="button"
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        lang.code === i18n.language
                          ? "text-teal-accent font-semibold bg-teal-50"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {lang.full}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
