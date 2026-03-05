/**
 * Profile Storage Service
 * Manages user profile data and saved items (prescriptions, lab reports, scans)
 */

export interface PatientProfile {
  type: "patient";
  fullName: string;
  mobile: string;
  email?: string;
  username?: string;
  village?: string;
  district: string;
  age: string;
  gender: string;
  createdAt: number;
}

export interface DoctorProfile {
  type: "doctor";
  fullName: string;
  registrationNumber: string;
  specialization: string;
  mobile: string;
  hospital: string;
  district: string;
  createdAt: number;
}

export type UserProfile = PatientProfile | DoctorProfile;

export interface SavedItem {
  id: string;
  type: "prescription" | "labReport" | "medicineScan" | "symptomCheck";
  title: string;
  imageUrl?: string;
  data: Record<string, unknown>;
  createdAt: number;
}

const PROFILE_KEY = "hs_user_profile";
const SAVED_ITEMS_KEY = "hs_saved_items";

// ─── Profile Management ─────────────────────────────────────────────────────

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(SAVED_ITEMS_KEY);
}

// ─── Saved Items Management ─────────────────────────────────────────────────

export function getSavedItems(): SavedItem[] {
  try {
    const raw = localStorage.getItem(SAVED_ITEMS_KEY);
    if (raw) return JSON.parse(raw) as SavedItem[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveItem(item: Omit<SavedItem, "id" | "createdAt">): SavedItem {
  const items = getSavedItems();
  const newItem: SavedItem = {
    ...item,
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  items.unshift(newItem); // Add to beginning
  localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(items));
  return newItem;
}

export function deleteItem(id: string): void {
  const items = getSavedItems().filter(item => item.id !== id);
  localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(items));
}

export function getItemsByType(type: SavedItem["type"]): SavedItem[] {
  return getSavedItems().filter(item => item.type === type);
}

// ─── Legacy compatibility ───────────────────────────────────────────────────

export function migrateFromLegacy(): void {
  // Check if already migrated
  if (getProfile()) return;

  const role = localStorage.getItem("userRole");
  if (!role) return;

  if (role === "patient") {
    const name = localStorage.getItem("patientName");
    if (name) {
      const profile: PatientProfile = {
        type: "patient",
        fullName: name,
        mobile: localStorage.getItem("patientMobile") || "",
        email: localStorage.getItem("patientEmail") || undefined,
        username: localStorage.getItem("patientUsername") || undefined,
        district: localStorage.getItem("patientDistrict") || "",
        age: localStorage.getItem("patientAge") || "",
        gender: localStorage.getItem("patientGender") || "",
        createdAt: Date.now(),
      };
      saveProfile(profile);
    }
  } else if (role === "doctor") {
    const name = localStorage.getItem("doctorName");
    if (name) {
      const profile: DoctorProfile = {
        type: "doctor",
        fullName: name,
        registrationNumber: localStorage.getItem("doctorRegNumber") || "",
        specialization: localStorage.getItem("doctorSpecialization") || "",
        mobile: localStorage.getItem("doctorMobile") || "",
        hospital: localStorage.getItem("doctorHospital") || "",
        district: localStorage.getItem("doctorDistrict") || "",
        createdAt: Date.now(),
      };
      saveProfile(profile);
    }
  }
}
