import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import MicButton from "../components/MicButton";

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ id: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!credentials.id.trim() || !credentials.password.trim()) {
      setError("Please enter your ID and password.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("userRole", "doctor");
      localStorage.setItem("isAuthenticated", "true");
      navigate("/doctor");
    }, 800);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[42%] bg-navy relative overflow-hidden flex-col">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-violet/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-accent/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px"}} />
        </div>
        <div className="relative flex flex-col h-full px-12 py-12">
          <Link to="/" className="flex items-center gap-2.5 mb-auto">
            <div className="w-9 h-9 rounded-xl bg-gradient-teal flex items-center justify-center shadow-glow">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">HealthSathi</span>
          </Link>
          <div className="py-16">
            <div className="w-16 h-16 bg-brand-violet/20 rounded-3xl flex items-center justify-center mb-8">
              <svg className="w-8 h-8 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Protecting rural<br />health at scale
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Disease maps, outbreak alerts & visit planning — all synced to your field device.
            </p>
            <ul className="space-y-3">
              {["Geographic disease heat maps", "Smart outbreak alerts & scoring", "Offline visit planning & sync"].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-brand-violet/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-600">Â© 2026 HealthSathi · For healthcare providers</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-slate-50">
        <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-teal flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="font-bold text-slate-900">HealthSathi</span>
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">← Back</Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-card border border-slate-200 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-brand-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900">Doctor Sign In</h1>
                <p className="text-sm text-slate-500 mt-1">Healthcare provider dashboard</p>
              </div>

              <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 p-3.5 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Doctor ID / Reg. Number</label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                      </span>
                      <input type="text" value={credentials.id}
                        onChange={(e) => setCredentials(c => ({ ...c, id: e.target.value }))}
                        placeholder="MCI registration number"
                        className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-violet/40 focus:border-brand-violet focus:bg-white transition-all"
                        disabled={loading} />
                    </div>
                    <MicButton onResult={(t) => setCredentials(c => ({ ...c, id: t }))} disabled={loading} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </span>
                      <input type={showPwd ? "text" : "password"} value={credentials.password}
                        onChange={(e) => setCredentials(c => ({ ...c, password: e.target.value }))}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-violet/40 focus:border-brand-violet focus:bg-white transition-all"
                        disabled={loading} />
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {showPwd ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                        </svg>
                      </button>
                    </div>
                    <MicButton onResult={(t) => setCredentials(c => ({ ...c, password: t }))} disabled={loading} />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 text-sm font-bold text-white bg-gradient-violet rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-violet focus:ring-offset-2 disabled:opacity-50 transition-all shadow-glow-violet">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Signing in...
                    </span>
                  ) : "Sign In →"}
                </button>

                <div className="pt-1 space-y-2 text-center">
                  <p className="text-sm text-slate-500">
                    New to HealthSathi?{" "}
                    <Link to="/doctor-register" className="text-brand-violet font-semibold hover:underline">Create account</Link>
                  </p>
                  <Link to="/" className="block text-sm text-slate-400 hover:text-slate-600 transition-colors">← Back to home</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
