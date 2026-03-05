import { Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";

export type AllowedRole = "patient" | "doctor";

interface ProtectedRouteProps {
  allowedRole: AllowedRole;
}

export default function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const role = localStorage.getItem("userRole");
  const isAuthenticated = localStorage.getItem("isAuthenticated");

  if (!isAuthenticated || role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout />
  );
}