import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import MicButton from "../components/MicButton";

type IdType = "mobile" | "email" | "username";
const TABS: { id: IdType; label: string }[] = [
  { id: "mobile", label: "Mobile" },
  { id: "email", label: "Email" },
  { id: "username", label: "Username" },
];

export default function PatientLogin() {
  const navigate = useNavigate();
  const [idType, setIdType] = useState<IdType>("mobile");
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const placeholders: Record<IdType, string> = {
    mobile: "10-digit mobile number",
    email: "your@email.com",
    username: "Your username",
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.identifier.trim()) {
      setError(`Please enter your ${idType === "mobile" ? "mobile number" : idType}.`);
      return;
    }
    if (idType === "mobile" && !/^[6-9]\d{9}$/.test(form.identifier)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (idType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.identifier)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!form.password) {
      setError("Please enter your password.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("userRole", "patient");
      localStorage.setItem("isAuthenticated", "true");
      navigate("/patient/dashboard");
    }, 800);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[42%] bg-navy relative overflow-hidden flex-col">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-accent/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-violet/10 rounded-full blur-3xl" />
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
            <div className="w-16 h-16 bg-teal-accent/20 rounded-3xl flex items-center justify-center mb-8">
              <svg className="w-8 h-8 text-teal-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Your health,<br />always with you
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Scan medicines, check symptoms, read lab reports — even without internet.
            </p>
            <ul className="space-y-3">
              {["Verify medicine authenticity instantly", "Offline access to all 7 tools", "Hindi, Marathi & English support"].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-teal-accent/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-teal-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-600">© 2026 HealthSathi · For guidance only</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {/* Mobile header */}
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
            {/* Card */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-200 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-teal-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900">Patient Sign In</h1>
                <p className="text-sm text-slate-500 mt-1">Welcome back — access your healthcare tools</p>
              </div>

              <form onSubmit={handleLogin} className="px-8 py-7 space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 p-3.5 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                  </div>
                )}

                {/* Identifier type tabs */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">Sign in with</label>
                  <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                    {TABS.map((tab) => (
                      <button key={tab.id} type="button"
                        onClick={() => { setIdType(tab.id); setForm(f => ({ ...f, identifier: "" })); setError(""); }}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                          idType === tab.id
                            ? "bg-white text-teal-accent shadow-sm border border-slate-200"
                            : "text-slate-500 hover:text-slate-700"
                        }`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        {idType === "mobile" && (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        )}
                        {idType === "email" && (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        )}
                        {idType === "username" && (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        )}
                      </span>
                      <input
                        type={idType === "email" ? "email" : "text"}
                        value={form.identifier}
                        onChange={(e) => setForm(f => ({ ...f, identifier: e.target.value }))}
                        placeholder={placeholders[idType]}
                        className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-accent/40 focus:border-teal-accent focus:bg-white transition-all"
                        disabled={loading}
                      />
                    </div>
                    <MicButton onResult={(t) => setForm(f => ({ ...f, identifier: t }))} disabled={loading} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </span>
                      <input type={showPwd ? "text" : "password"} value={form.password}
                        onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-accent/40 focus:border-teal-accent focus:bg-white transition-all"
                        disabled={loading} />
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {showPwd ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                        </svg>
                      </button>
                    </div>
                    <MicButton onResult={(t) => setForm(f => ({ ...f, password: t }))} disabled={loading} />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 text-sm font-bold text-white bg-gradient-teal rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-teal-accent focus:ring-offset-2 disabled:opacity-50 transition-all shadow-glow">
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
                    <Link to="/patient-register" className="text-teal-accent font-semibold hover:underline">Create free account</Link>
                  </p>
                  <Link to="/" className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">← Back to home</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
