import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import MicButton from "../components/MicButton";
import { saveProfile, type DoctorProfile } from "../services/profileStorage";

const SPECIALIZATIONS = [
  "General Medicine", "Pediatrics", "Obstetrics & Gynecology",
  "Surgery", "Orthopedics", "Dermatology", "ENT",
  "Ophthalmology", "Psychiatry", "Community Medicine",
  "AYUSH / Traditional Medicine", "Other",
];

const DISTRICTS = [
  "Ahmednagar", "Beed", "Buldhana", "Chandrapur", "Dhule",
  "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna",
  "Kolhapur", "Latur", "Nagpur", "Nanded", "Nandurbar",
  "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune",
  "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg",
  "Solapur", "Thane", "Wardha", "Washim", "Yavatmal",
];

export default function DoctorRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "", registrationNumber: "", specialization: "",
    mobile: "", hospital: "", district: "", password: "", confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.fullName.trim()) e.fullName = "Name is required";
    if (!form.registrationNumber.trim()) e.registrationNumber = "Registration number is required";
    if (!form.specialization) e.specialization = "Select a specialization";
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = "Enter a valid 10-digit mobile";
    if (!form.hospital.trim()) e.hospital = "Hospital name is required";
    if (!form.district) e.district = "Select a district";
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
      const profile: DoctorProfile = {
        type: "doctor",
        fullName: form.fullName,
        registrationNumber: form.registrationNumber,
        specialization: form.specialization,
        mobile: form.mobile,
        hospital: form.hospital,
        district: form.district,
        createdAt: Date.now(),
      };
      saveProfile(profile);
      localStorage.setItem("userRole", "doctor");
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("doctorName", form.fullName);
      setDone(true);
      setTimeout(() => navigate("/doctor"), 1800);
    }, 900);
  };

  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center px-6">
      <div className="text-center animate-scale-in">
        <div className="w-20 h-20 bg-gradient-violet rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow-violet">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Welcome, Dr. {form.fullName.split(" ").pop()}!</h2>
        <p className="text-slate-500">Account created. Redirecting to dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-teal flex items-center justify-center shadow-glow">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <span className="font-bold text-slate-900">HealthSathi</span>
        </Link>
        <Link to="/doctor-login" className="text-sm font-medium text-brand-violet hover:underline">Already registered? Sign In</Link>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-violet rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-violet">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900">Create Doctor Account</h1>
            <p className="text-slate-500 mt-2">For healthcare providers  · Takes 2 minutes</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-3xl shadow-card border border-slate-200 overflow-hidden">
              {/* Professional Info */}
              <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Professional Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} placeholder="Dr. Sunita Sharma"
                        className={`flex-1 px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.fullName ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`} />
                      <MicButton onResult={(t) => set("fullName")(t)} />
                    </div>
                    {errors.fullName && <p className="text-xs text-rose-500 mt-1">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">MCI / State Reg. No. <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={form.registrationNumber} onChange={(e) => set("registrationNumber")(e.target.value)} placeholder="e.g. MH-12345"
                        className={`flex-1 px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.registrationNumber ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`} />
                      <MicButton onResult={(t) => set("registrationNumber")(t)} />
                    </div>
                    {errors.registrationNumber && <p className="text-xs text-rose-500 mt-1">{errors.registrationNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specialization <span className="text-rose-500">*</span></label>
                    <select value={form.specialization} onChange={(e) => set("specialization")(e.target.value)}
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.specialization ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`}>
                      <option value="">Select specialization</option>
                      {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.specialization && <p className="text-xs text-rose-500 mt-1">{errors.specialization}</p>}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="px-8 py-6 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Practice Location</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hospital / Health Centre <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={form.hospital} onChange={(e) => set("hospital")(e.target.value)} placeholder="PHC Wardha"
                        className={`flex-1 px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.hospital ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`} />
                      <MicButton onResult={(t) => set("hospital")(t)} />
                    </div>
                    {errors.hospital && <p className="text-xs text-rose-500 mt-1">{errors.hospital}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Serving District <span className="text-rose-500">*</span></label>
                    <select value={form.district} onChange={(e) => set("district")(e.target.value)}
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.district ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`}>
                      <option value="">Select district</option>
                      {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.district && <p className="text-xs text-rose-500 mt-1">{errors.district}</p>}
                  </div>
                </div>
              </div>

              {/* Account */}
              <div className="px-8 py-6 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Account Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile Number <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} placeholder="10-digit number"
                        className={`flex-1 px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.mobile ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`} />
                      <MicButton onResult={(t) => set("mobile")(t)} />
                    </div>
                    {errors.mobile && <p className="text-xs text-rose-500 mt-1">{errors.mobile}</p>}
                  </div>
                  <div />
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password <span className="text-rose-500">*</span></label>
                    <input type="password" value={form.password} onChange={(e) => set("password")(e.target.value)} placeholder="Min. 6 characters"
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.password ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`} />
                    {errors.password && <p className="text-xs text-rose-500 mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password <span className="text-rose-500">*</span></label>
                    <input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword")(e.target.value)} placeholder="Repeat password"
                      className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.confirmPassword ? "border-rose-400 focus:ring-rose-300" : "border-slate-200 focus:ring-brand-violet/40 focus:border-brand-violet"}`} />
                    {errors.confirmPassword && <p className="text-xs text-rose-500 mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>

              <div className="px-8 py-6">
                <button type="submit" disabled={loading}
                  className="w-full py-4 text-sm font-bold text-white bg-gradient-violet rounded-2xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-violet focus:ring-offset-2 disabled:opacity-50 transition-all shadow-glow-violet">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Creating account…
                    </span>
                  ) : "Create Account →"}
                </button>
                <p className="text-center text-sm text-slate-500 mt-4">
                  Already registered?{" "}
                  <Link to="/doctor-login" className="text-brand-violet font-semibold hover:underline">Sign In</Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
