import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", full: "English" },
  { code: "hi", full: "हिंदी" },
  { code: "mr", full: "मराठी" },
] as const;

const STATS = [
  { value: "300M+", label: "Unserved People", color: "text-violet-400" },
  { value: "20%", label: "Counterfeit Medicines", color: "text-rose-400" },
  { value: "50+", label: "Villages per Doctor", color: "text-amber-400" },
  { value: "100%", label: "Works Offline", color: "text-emerald-400" },
];

const PATIENT_FEATURES = [
  { icon: "💊", title: "Medicine Scanner", desc: "Photo-based AI identifies any medicine instantly", color: "bg-teal-50 border-teal-100" },
  { icon: "🔍", title: "Counterfeit Check", desc: "Catch fake medicines via QR & packaging AI", color: "bg-rose-50 border-rose-100" },
  { icon: "⚠️", title: "Drug Interactions", desc: "Warns about dangerous medication combinations", color: "bg-amber-50 border-amber-100" },
  { icon: "📄", title: "Prescription Reader", desc: "Converts illegible handwriting to clear text", color: "bg-blue-50 border-blue-100" },
  { icon: "🧪", title: "Lab Reports", desc: "Blood tests explained in plain simple language", color: "bg-cyan-50 border-cyan-100" },
  { icon: "🩺", title: "Symptom Checker", desc: "AI suggests possible causes and next steps", color: "bg-violet-50 border-violet-100" },
  { icon: "📚", title: "Health Library", desc: "200+ topics pre-downloaded, always available", color: "bg-emerald-50 border-emerald-100" },
];

const DOCTOR_FEATURES = [
  { icon: "📋", title: "Community Dashboard", desc: "Live patient trends & health analytics" },
  { icon: "🗺️", title: "Disease Heat Maps", desc: "Visual outbreak cluster detection" },
  { icon: "🔔", title: "Smart Alerts", desc: "\"Fever cluster detected\" — instant notification" },
  { icon: "🏕", title: "Visit Planning", desc: "Download data, work offline, auto-sync" },
];

function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        {current.full}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 top-full mt-1.5 w-36 py-1 bg-white border border-slate-200 rounded-xl shadow-card z-20">
            {LANGUAGES.map((lang) => (
              <li key={lang.code}>
                <button type="button" onClick={() => { i18n.changeLanguage(lang.code); localStorage.setItem("language", lang.code); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${lang.code === i18n.language ? "text-teal-accent font-semibold bg-teal-50" : "text-slate-700 hover:bg-slate-50"}`}>
                  {lang.full}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setCanInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setCanInstall(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ HEADER Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <header className="sticky top-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-teal flex items-center justify-center shadow-glow">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">HealthSathi</p>
              <p className="text-xs text-slate-400 leading-tight">Offline Healthcare Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canInstall && (
              <button onClick={handleInstall}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-navy bg-teal-muted rounded-xl hover:bg-teal-200 transition-colors shadow-glow">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Install App
              </button>
            )}
            <LanguageSelector />
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ HERO Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <section className="relative bg-navy overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-teal-accent/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 -left-48 w-[400px] h-[400px] bg-brand-violet/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/3 w-[300px] h-[300px] bg-teal-accent/8 rounded-full blur-2xl" />
            {/* Grid lines */}
            <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px"}} />
          </div>

          <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-accent/15 border border-teal-accent/30 rounded-full text-sm font-medium text-teal-muted mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              AI-Powered · Works 100% Offline · 3 Languages
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
              Healthcare for Every<br />
              <span className="text-transparent bg-clip-text bg-gradient-teal">Village</span> in India
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Verify medicines, check symptoms, read prescriptions —<br className="hidden sm:block" />
              all without internet. Built for rural India's 300M+ underserved.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate("/patient-login")}
                className="group px-8 py-4 text-base font-bold text-white bg-gradient-teal rounded-2xl hover:opacity-90 shadow-glow transition-all duration-200 hover:scale-[1.02]">
                Patient Portal
                <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">→</span>
              </button>
              <button onClick={() => navigate("/doctor-login")}
                className="group px-8 py-4 text-base font-bold text-white border border-white/20 bg-white/5 rounded-2xl hover:bg-white/10 transition-all duration-200 hover:scale-[1.02]">
                Doctor Portal
                <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">→</span>
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="relative border-t border-white/10 bg-white/[0.03]">
            <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ PORTAL CARDS Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <section className="px-6 py-20 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Choose Your Portal</h2>
              <p className="text-slate-500">New here? Register free in under 2 minutes.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Patient card */}
              <div className="group relative bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="h-1.5 bg-gradient-teal" />
                <div className="p-8">
                  <div className="w-14 h-14 bg-gradient-teal rounded-2xl flex items-center justify-center mb-5 shadow-glow">
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Patient Portal</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">Verify medicines, scan prescriptions, check symptoms & lab reports. Works fully offline.</p>
                  <ul className="space-y-1.5 mb-7">
                    {["Medicine verification", "Symptom checker", "Lab report reader", "Works offline"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="w-4 h-4 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3">
                    <button onClick={() => navigate("/patient-login")}
                      className="flex-1 py-3 text-sm font-bold text-white bg-gradient-teal rounded-xl hover:opacity-90 shadow-glow transition-all">Sign In</button>
                    <button onClick={() => navigate("/patient-register")}
                      className="flex-1 py-3 text-sm font-bold text-teal-accent border-2 border-teal-accent/30 bg-teal-50 rounded-xl hover:bg-teal-100 transition-all">Register Free</button>
                  </div>
                </div>
              </div>

              {/* Doctor card */}
              <div className="group relative bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="h-1.5 bg-gradient-violet" />
                <div className="p-8">
                  <div className="w-14 h-14 bg-gradient-violet rounded-2xl flex items-center justify-center mb-5 shadow-glow-violet">
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Doctor Portal</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">Dashboard, disease maps, outbreak alerts & visit planning for field healthcare workers.</p>
                  <ul className="space-y-1.5 mb-7">
                    {["Geographic heat maps", "Smart outbreak alerts", "Visit planning", "Offline sync"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="w-4 h-4 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3">
                    <button onClick={() => navigate("/doctor-login")}
                      className="flex-1 py-3 text-sm font-bold text-white bg-gradient-violet rounded-xl hover:opacity-90 shadow-glow-violet transition-all">Sign In</button>
                    <button onClick={() => navigate("/doctor-register")}
                      className="flex-1 py-3 text-sm font-bold text-brand-violet border-2 border-brand-violet/30 bg-violet-50 rounded-xl hover:bg-violet-100 transition-all">Register Free</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ PATIENT FEATURES Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <section className="px-6 py-20 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-xl">👤</div>
              <h2 className="text-3xl font-bold text-slate-900">7 Patient Features</h2>
            </div>
            <p className="text-base text-slate-500 mb-10 ml-14">All features work offline. Zero internet needed. Hindi + Marathi supported.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {PATIENT_FEATURES.map((f) => (
                <div key={f.title} className={`flex gap-3.5 p-4 border rounded-2xl ${f.color} hover:scale-[1.02] transition-transform duration-200 cursor-default`}>
                  <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <h4 className="text-base font-bold text-slate-800 mb-1">{f.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ DOCTOR FEATURES Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <section className="px-6 py-20 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-accent/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-brand-violet/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">🩺</div>
              <h2 className="text-3xl font-bold text-white">4 Doctor Features</h2>
            </div>
            <p className="text-base text-slate-400 mb-10 ml-14">Sync when connected. Work fully offline in the field.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {DOCTOR_FEATURES.map((f) => (
                <div key={f.title} className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors duration-200">
                  <span className="text-3xl block mb-3">{f.icon}</span>
                  <h4 className="text-base font-bold text-white mb-1.5">{f.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ OFFLINE CALLOUT Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <section className="px-6 py-20 bg-gradient-to-br from-teal-50 to-emerald-50 border-y border-teal-100">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 bg-gradient-teal rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-glow">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Works Anywhere. Always.</h2>
            <p className="text-slate-600 text-lg leading-relaxed max-w-xl mx-auto mb-8">
              On-Device AI + 300MB Offline Database + Smart Sync. No internet required.
              Even SMS mode for basic feature phones.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["On-Device AI", "300MB Offline DB", "Auto Sync", "Hindi & Marathi", "SMS Mode"].map((badge) => (
                <span key={badge} className="px-4 py-2 bg-white border border-teal-200 text-teal-700 text-sm font-semibold rounded-full shadow-soft">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ FOOTER Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <footer className="bg-navy border-t border-white/10 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-teal flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">HealthSathi</span>
            <span className="text-slate-500 text-sm">v1.0.0</span>
          </div>
          <p className="text-sm text-slate-500 max-w-lg">
            For informational and decision-support purposes only. Does not replace professional medical advice. Consult a qualified healthcare provider for medical concerns.
          </p>
        </div>
      </footer>
    </div>
  );
}
