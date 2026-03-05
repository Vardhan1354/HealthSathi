import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import DoctorLogin from "./pages/DoctorLogin";
import DoctorRegister from "./pages/DoctorRegister";
// PatientDashboard moved to lazy loading
import MedicineScanner from "./pages/MedicineScanner";
import CounterfeitDetection from "./pages/CounterfeitDetection";
import InteractionChecker from "./pages/InteractionChecker";
import PrescriptionReader from "./pages/PrescriptionReader";
import LabReports from "./pages/LabReports";
import SymptomChecker from "./pages/SymptomChecker";
import HealthLibrary from "./pages/HealthLibrary";
import DoctorDashboard from "./pages/DoctorDashboard";
import HeatMap from "./pages/HeatMap";
import Alerts from "./pages/Alerts";
import VisitPlanning from "./pages/VisitPlanning";
import PatientLogin from "./pages/PatientLogin";
import PatientRegister from "./pages/PatientRegister";
import Profile from "./pages/Profile";
import { AlertProvider } from "./context/AlertContext";
import { VisitProvider } from "./context/VisitContext";

function App() {
  return (
    <AlertProvider>
      <VisitProvider>
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/doctor-login" element={<DoctorLogin />} />
        <Route path="/doctor-register" element={<DoctorRegister />} />
        <Route path="/patient-login" element={<PatientLogin/>} />
        <Route path="/patient-register" element={<PatientRegister />} />

        {/* Protected patient routes — nested under /patient */}
        <Route path="/patient" element={<ProtectedRoute allowedRole="patient" />}>
          <Route index element={<Navigate to="health-library" replace />} />
          <Route path="dashboard" element={<Navigate to="/patient/health-library" replace />} />
          <Route path="medicine-scanner" element={<MedicineScanner />} />
          <Route path="counterfeit" element={<CounterfeitDetection />} />
          <Route path="interaction" element={<InteractionChecker />} />
          <Route path="prescription" element={<PrescriptionReader />} />
          <Route path="lab-reports" element={<LabReports />} />
          <Route path="symptom-checker" element={<SymptomChecker />} />
          <Route path="health-library" element={<HealthLibrary />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Legacy flat patient paths — redirect to nested */}
        <Route path="/patient-dashboard" element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="/medicine-scanner" element={<Navigate to="/patient/medicine-scanner" replace />} />
        <Route path="/counterfeit" element={<Navigate to="/patient/counterfeit" replace />} />
        <Route path="/interaction" element={<Navigate to="/patient/interaction" replace />} />
        <Route path="/prescription" element={<Navigate to="/patient/prescription" replace />} />
        <Route path="/lab-reports" element={<Navigate to="/patient/lab-reports" replace />} />
        <Route path="/symptom-checker" element={<Navigate to="/patient/symptom-checker" replace />} />
        <Route path="/health-library" element={<Navigate to="/patient/health-library" replace />} />

        {/* Protected doctor routes */}
        <Route path="/doctor" element={<ProtectedRoute allowedRole="doctor" />}>
          <Route index element={<DoctorDashboard />} />
          <Route path="heatmap" element={<HeatMap />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="visit-planning" element={<VisitPlanning />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </VisitProvider>
    </AlertProvider>
  );
}

export default App;
