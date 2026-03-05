// ─── HealthSathi API Client ──────────────────────────────────────────────────
// Centralised API layer — all backend calls go through here.
// Replace mock data with real calls by importing from this file.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY  = import.meta.env.VITE_API_KEY || '';

// ─── BASE FETCH ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000), // fail fast so free-API fallback kicks in quickly
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, err.error || 'Request failed', path);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  path: string;
  constructor(status: number, message: string, path: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ExplainReportResponse {
  explanation: string | null;
  type: string;
  model: string;
  fallback?: boolean;
  error?: string;
}

export interface VerifyMedicineResponse {
  barcode: string;
  verdict: 'genuine' | 'suspicious' | 'counterfeit';
  confidence: number;
  checks: Array<{
    id: string;
    label: string;
    status: 'pass' | 'fail' | 'warn';
    detail: string;
  }>;
  apiSource: string;
  fromCache?: boolean;
}

export interface SyncItem {
  id: string;
  type: 'medicine_scan' | 'doctor_request' | 'counterfeit_report' | 'visit_log';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface SyncResponse {
  results: Array<{ id: string; synced: boolean }>;
  errors:  Array<{ id: string; synced: false; error: string }>;
  updates: unknown[];
  serverTimestamp: number;
}

export interface DashboardResponse {
  doctor: { id: string; name: string; villages: string[] };
  requests: {
    urgent: unknown[];
    medium: unknown[];
    low:    unknown[];
    total:  number;
  };
  trends: {
    period: string;
    daily: Array<{ date: string; scans: number; counterfeits: number }>;
    topSymptoms: Array<{ name: string; count: number }>;
    totalScans: number;
  };
  alerts: Array<{
    type: string;
    village: string;
    severity: string;
    message: string;
    actionRequired: boolean;
    timestamp: number;
  }>;
  stats: {
    medicineScans: number;
    counterfeitsFound: number;
    prescriptionsRead: number;
  };
  lastUpdated: number;
}

// ─── API METHODS ──────────────────────────────────────────────────────────────

/**
 * Explain a lab report (text input) via AWS Bedrock Claude.
 * Backend: lab-report Lambda → Textract (if s3Key) or direct text → Bedrock
 * Used by: LabReports.tsx
 */
export async function explainReport(
  textOrS3Key: string,
  type: 'lab_report' | 'prescription',
  language: 'en' | 'hi' | 'mr' = 'en',
  patientId?: string
): Promise<ExplainReportResponse> {
  const isS3 = textOrS3Key.startsWith('uploads/') || textOrS3Key.includes('/');
  return apiFetch<ExplainReportResponse>('/api/explain-report', {
    method: 'POST',
    body: JSON.stringify(isS3
      ? { s3Key: textOrS3Key, language, patientId }
      : { text: textOrS3Key, type, language, patientId }),
  });
}

/**
 * Read a prescription: AWS Textract OCR → Bedrock Claude explanation.
 * Used by: PrescriptionReader.tsx
 */
export async function readPrescription(
  s3Key: string,
  language: 'en' | 'hi' | 'mr' = 'en',
  patientId?: string
): Promise<ExplainReportResponse & { ocrText: string; ocrConfidence: number; keyValues: Record<string, string> }> {
  return apiFetch('/api/read-prescription', {
    method: 'POST',
    body: JSON.stringify({ s3Key, language, patientId }),
  });
}

/**
 * Scan a medicine image: AWS Rekognition → Bedrock Claude category explanation.
 * Backend: medicine-scanner Lambda
 * Used by: MedicineScanner.tsx
 */
export async function scanMedicine(
  s3Key: string,
  language: 'en' | 'hi' | 'mr' = 'en'
): Promise<{ explanation: string; detectedLabels: string[]; detectedText: string[]; model: string }> {
  return apiFetch('/api/scan-medicine', {
    method: 'POST',
    body: JSON.stringify({ s3Key, language }),
  });
}

/**
 * Verify if a medicine is genuine via AWS Rekognition + Bedrock.
 * Optionally pass s3Key for full image analysis.
 * Used by: CounterfeitDetection.tsx
 */
export async function verifyMedicine(
  barcode: string,
  s3Key?: string,
  medicineData: { hasHologram?: boolean; batchNumber?: string } = {}
): Promise<VerifyMedicineResponse> {
  return apiFetch<VerifyMedicineResponse>('/api/verify-medicine', {
    method: 'POST',
    body: JSON.stringify({ barcode, s3Key, ...medicineData }),
  });
}

/**
 * Check drug interactions using AWS Bedrock Claude.
 * Used by: InteractionChecker.tsx
 */
export async function checkInteractions(
  medicines: string[],
  language: 'en' | 'hi' | 'mr' = 'en'
): Promise<{
  medicines: string[];
  overallRisk: 'safe' | 'caution' | 'avoid';
  summary: string;
  interactions: Array<{
    pair: string[];
    severity: 'major' | 'moderate' | 'minor' | 'none';
    effect: string;
    recommendation: string;
  }>;
  generalAdvice: string[];
  seeDoctor: boolean;
  fromCache: boolean;
}> {
  return apiFetch('/api/check-interactions', {
    method: 'POST',
    body: JSON.stringify({ medicines, language }),
  });
}

/**
 * Translate health content using AWS Translate.
 * Supports: en ↔ hi ↔ mr (and other Indian languages)
 * Used by: any page needing translation
 */
export async function translateText(
  text: string,
  targetLanguage: 'en' | 'hi' | 'mr' | string,
  sourceLanguage: 'en' | 'hi' | 'mr' | 'auto' = 'auto'
): Promise<{ translatedText: string; detectedSourceLang: string; targetLanguage: string }> {
  return apiFetch('/api/translate', {
    method: 'POST',
    body: JSON.stringify({ text, targetLanguage, sourceLanguage }),
  });
}

/**
 * Convert text to speech using AWS Polly (Hindi/Marathi/English).
 * Returns a pre-signed S3 URL for the MP3, plus base64 inline fallback.
 * Used by: SymptomChecker.tsx, HealthLibrary.tsx
 */
export async function synthesizeSpeech(
  text: string,
  language: 'en' | 'hi' | 'mr' = 'en'
): Promise<{ audioUrl: string | null; audioBase64: string; voiceId: string; language: string }> {
  return apiFetch('/api/speak', {
    method: 'POST',
    body: JSON.stringify({ text, language }),
  });
}

/**
 * Sync offline queue to backend.
 * Used by: syncQueue.ts background service
 */
export async function syncOfflineQueue(
  userId: string,
  syncQueue: SyncItem[]
): Promise<SyncResponse> {
  return apiFetch<SyncResponse>('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ userId, syncQueue }),
  });
}

/**
 * Get doctor dashboard aggregated data.
 * Used by: DoctorDashboard.tsx
 */
export async function getDashboard(doctorId: string): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`/api/dashboard/${doctorId}`);
}

/**
 * Trigger outbreak detection + SNS alert.
 * Used by: HeatMap.tsx (doctor only)
 */
export async function detectOutbreaks(
  symptomReports: Array<{
    id?: string;
    village: string;
    doctorId?: string;
    symptoms: string[];
    location: { lat: number; lon: number };
    timestamp: number;
  }>
) {
  return apiFetch('/api/outbreak-detect', {
    method: 'POST',
    body: JSON.stringify({ symptomReports }),
  });
}

/**
 * Upload a file directly to S3 via a pre-signed PUT URL.
 * Flow: client → GET /api/presign → S3 presigned PUT → returns s3Key for Lambda use.
 * Used before any Textract / Rekognition call.
 */
export async function uploadFileForAnalysis(file: File, prefix = 'uploads'): Promise<string> {
  const s3Key = `${prefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Get presigned URL from our Lambda (replaces VITE_PRESIGN_URL env var)
  const presignRes = await apiFetch<{ url: string; s3Key: string }>(
    `/api/presign?key=${encodeURIComponent(s3Key)}&type=${encodeURIComponent(file.type)}`
  );

  await fetch(presignRes.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  return presignRes.s3Key;
}

/**
 * Check symptoms using Amazon Bedrock Claude.
 * Uses the health-library/ask endpoint with a structured prompt.
 * Used by: SymptomChecker.tsx
 */
export async function checkSymptoms(
  symptoms: string[],
  duration: string,
  severity: string,
  ageGroup: string,
  language: 'en' | 'hi' | 'mr' = 'en'
): Promise<{ answer: string; model: string }> {
  const prompt = `Patient symptoms: ${symptoms.join(', ')}. Duration: ${duration}. Severity: ${severity}. Patient: ${ageGroup}. Provide possible conditions with confidence percentage, home remedies, warning signs, and when to see a doctor. Keep response structured and practical for rural India.`;
  const sessionId = `symptom-${Date.now()}`;
  const res = await apiFetch<{ answer: string; model: string }>('/api/health-library/ask', {
    method: 'POST',
    body: JSON.stringify({ question: prompt, sessionId, language }),
  });
  return res;
}

/**
 * Ask the Health Library AI (Amazon Nova Lite via Bedrock).
 * Conversation history is persisted per sessionId in S3.
 * Used by: HealthLibrary.tsx
 */
export async function askHealthLibrary(
  question: string,
  sessionId: string,
  language: 'en' | 'hi' | 'mr' = 'en'
): Promise<{ answer: string; model: string; turnCount: number; latencyMs: number }> {
  return apiFetch('/api/health-library/ask', {
    method: 'POST',
    body: JSON.stringify({ question, sessionId, language }),
  });
}

/**
 * Retrieve conversation history for a Health Library session.
 * Used by: HealthLibrary.tsx (session restore on page load)
 */
export async function getHealthLibraryHistory(
  sessionId: string
): Promise<{ sessionId: string; messages: Array<{ role: string; content: Array<{ text: string }> }> }> {
  return apiFetch(`/api/health-library/history?sessionId=${encodeURIComponent(sessionId)}`);
}
