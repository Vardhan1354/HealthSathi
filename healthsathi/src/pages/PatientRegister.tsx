import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import MicButton from "../components/MicButton";
import { saveProfile, type PatientProfile } from "../services/profileStorage";

const DISTRICTS = [
  "Ahmednagar", "Beed", "Buldhana", "Chandrapur", "Dhule",
  "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna",
  "Kolhapur", "Latur", "Nagpur", "Nanded", "Nandurbar",
  "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune",
  "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg",
  "Solapur", "Thane", "Wardha", "Washim", "Yavatmal",
];

export default function PatientRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", mobile: "", email: "", username: "", village: "", district: "", age: "", gender: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.fullName.trim()) e.fullName = "Name is required";
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = "Enter a valid 10-digit mobile";
    if (!form.district) e.district = "Select a district";
    if (!form.age || +form.age < 1 || +form.age > 120) e.age = "Enter a valid age";
    if (!form.gender) e.gender = "Select gender";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      // Save full profile
      const profile: PatientProfile = {
        type: "patient",
        fullName: form.fullName,
        mobile: form.mobile,
        email: form.email || undefined,
        username: form.username || undefined,
        village: form.village || undefined,
        district: form.district,
        age: form.age,
        gender: form.gender,
        createdAt: Date.now(),
      };
      saveProfile(profile);
      localStorage.setItem("userRole", "patient");
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("patientName", form.fullName);
      setDone(true);
      setTimeout(() => navigate("/patient/dashboard"), 1800);
    }, 900);
  };

  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center px-6">
      <div className="text-center animate-scale-in">
        <div className="w-20 h-20 bg-gradient-teal rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Welcome, {form.fullName.split(" ")[0]}!</h2>
        <p className="text-slate-500">Account created. Redirecting to your dashboardâ€¦</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-teal flex items-center justify-center shadow-glow">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <span className="font-bold text-slate-900">HealthSathi</span>
        </Link>
        <Link to="/patient-login" className="text-sm font-medium text-teal-accent hover:underline">Already have an account? Sign In</Link>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-teal rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900">Create Patient Account</h1>
            <p className="text-slate-500 mt-2">Free forever Â· Works offline Â· Takes 2 minutes</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-3xl shadow-card border border-slate-200 overflow-hidden">
              {/* Section: Personal */}
              <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Personal Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} placeholder="Enter your full name"
                        className={`flex-1 px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.fullName ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-teal-accent/40 focus:border-teal-accent"}`} />
                      <MicButton onResult={(t) => set("fullName")(t)} />
                    </div>
                    {errors.fullName && <p className="text-xs text-rose-500 mt-1">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Age <span className="text-rose-500">*</span></label>
                    <input type="number" value={form.age} onChange={(e) => set("age")(e.target.value)} placeholder="Your age"
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.age ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-teal-accent/40 focus:border-teal-accent"}`} />
                    {errors.age && <p className="text-xs text-rose-500 mt-1">{errors.age}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender <span className="text-rose-500">*</span></label>
                    <select value={form.gender} onChange={(e) => set("gender")(e.target.value)}
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.gender ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-teal-accent/40 focus:border-teal-accent"}`}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.gender && <p className="text-xs text-rose-500 mt-1">{errors.gender}</p>}
                  </div>
                </div>
              </div>

              {/* Section: Location */}
              <div className="px-8 py-6 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Location</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Village / Town</label>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={form.village} onChange={(e) => set("village")(e.target.value)} placeholder="Your village or town"
                        className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-accent/40 focus:border-teal-accent focus:bg-white transition-all" />
                      <MicButton onResult={(t) => set("village")(t)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">District <span className="text-rose-500">*</span></label>
                    <select value={form.district} onChange={(e) => set("district")(e.target.value)}
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.district ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-teal-accent/40 focus:border-teal-accent"}`}>
                      <option value="">Select district</option>
                      {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.district && <p className="text-xs text-rose-500 mt-1">{errors.district}</p>}
                  </div>
                </div>
              </div>

              {/* Section: Account */}
              <div className="px-8 py-6 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Account Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile Number <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} placeholder="10-digit mobile number"
                        className={`flex-1 px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.mobile ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-teal-accent/40 focus:border-teal-accent"}`} />
                      <MicButton onResult={(t) => set("mobile")(t)} />
                    </div>
                    {errors.mobile && <p className="text-xs text-rose-500 mt-1">{errors.mobile}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="your@email.com"
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-accent/40 focus:border-teal-accent focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="text" value={form.username} onChange={(e) => set("username")(e.target.value)} placeholder="Choose a username"
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-accent/40 focus:border-teal-accent focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password <span className="text-rose-500">*</span></label>
                    <input type="password" value={form.password} onChange={(e) => set("password")(e.target.value)} placeholder="Min. 6 characters"
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.password ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-teal-accent/40 focus:border-teal-accent"}`} />
                    {errors.password && <p className="text-xs text-rose-500 mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password <span className="text-rose-500">*</span></label>
                    <input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword")(e.target.value)} placeholder="Repeat your password"
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.confirmPassword ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-teal-accent/40 focus:border-teal-accent"}`} />
                    {errors.confirmPassword && <p className="text-xs text-rose-500 mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="px-8 py-6">
                <button type="submit" disabled={loading}
                  className="w-full py-4 text-sm font-bold text-white bg-gradient-teal rounded-2xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-teal-accent focus:ring-offset-2 disabled:opacity-50 transition-all shadow-glow">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Creating accountâ€¦
                    </span>
                  ) : "Create Account â†’"}
                </button>
                <p className="text-center text-sm text-slate-500 mt-4">
                  Already registered?{" "}
                  <Link to="/patient-login" className="text-teal-accent font-semibold hover:underline">Sign In</Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
