import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFileForAnalysis, readPrescription } from "../services/api";
import TranslatableText from "../components/TranslatableText";
import ReadAloudButton from "../components/ReadAloudButton";
import CameraCapture from "../components/CameraCapture";
import { ocrExtractText, extractMedicineNames } from "../services/freeApis";
import { useTranslation } from "react-i18next";
import { freeTranslate } from "../services/freeTranslate";
import { saveScan, addToBridgeQueue } from "../services/storage";

type AppState = "upload" | "processing" | "results";

interface ApiResult {
  explanation: string;
  explanationEn: string;
  ocrText: string;
  ocrConfidence: number;
  keyValues: Record<string, string>;
  model: string;
  fallback?: boolean;
}



const STEP_KEYS = ["readingHandwriting", "decodingAbbreviations", "findingMedicines", "buildingExplanation"];

const URGENT_SYMPTOMS_KEYS = [
  "urgentFever",
  "urgentBreathing",
  "urgentChestPain",
  "urgentAllergy",
];
const URGENT_SYMPTOMS_FALLBACK = [
  "High fever (104F+) that will not reduce with medicine",
  "Difficulty breathing or chest tightness",
  "Severe chest pain",
  "Allergic reaction - rash, swelling, hives",
];

function UploadState({ onFile, isOnline }: { onFile: (f: File) => void; isOnline: boolean }) {
  const { t } = useTranslation();
  const tipKeys = ["tipClearPhoto", "tipAllTextVisible", "tipHoldSteady", "tipDoctorStamp"];
  const tipFallbacks = ["Clear, well-lit photo", "All text visible - no shadows", "Hold steady - no blur", "Include doctor stamp if possible"];
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in">
      <div className="w-24 h-24 bg-hs-blue-light rounded-3xl flex items-center justify-center mb-6 shadow-soft">
        <span className="text-5xl">📋</span>
      </div>
      <h2 className="text-xl font-bold text-hs-text mb-2">{t("prescriptionReaderTitle", "Prescription Reader")}</h2>
      <p className="text-sm text-hs-text-secondary text-center max-w-xs mb-8 leading-relaxed">
        {t("prescriptionUploadHint", "Upload a photo of your prescription. Our AI will explain each medicine in simple language.")}
      </p>
      {!isOnline && (
        <div className="w-full max-w-sm mb-4 hs-card bg-yellow-50 border-2 border-yellow-400 text-center">
          <p className="font-bold text-yellow-800">{t("noInternetTitle", "No Internet Connection")}</p>
          <p className="text-sm text-yellow-700 mt-1">{t("noInternetDesc", "This feature needs internet to read your prescription.")}</p>
        </div>
      )}
      <div className="w-full max-w-sm mb-6">
        <CameraCapture
          onCapture={onFile}
          onGallery={onFile}
          disabled={!isOnline}
        />
      </div>
      <details className="w-full max-w-sm hs-card-sm cursor-pointer">
        <summary className="text-sm font-semibold text-hs-text select-none">{t("tipsForBestResults", "Tips for best results")}</summary>
        <ul className="mt-2 space-y-1">
          {tipKeys.map((k, i) => (
            <li key={k} className="flex items-center gap-2 text-sm text-hs-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-hs-blue flex-shrink-0" />{t(k, tipFallbacks[i])}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ProcessingState({ imageUrl }: { imageUrl: string }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(10);
  const stepIdx = Math.min(Math.floor(progress / 25), 3);
  useEffect(() => {
    const iv = setInterval(() => setProgress(p => Math.min(p + 3, 90)), 250);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="px-4 py-6 max-w-sm mx-auto animate-fade-in">
      <img src={imageUrl} alt="Prescription" className="w-full h-48 object-cover rounded-2xl shadow-soft mb-6" />
      <div className="hs-card space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-hs-text font-medium">{t(STEP_KEYS[stepIdx], STEP_KEYS[stepIdx])}</span>
          <span className="text-hs-blue font-bold">{progress}%</span>
        </div>
        <div className="h-3 bg-hs-bg rounded-full overflow-hidden">
          <div className="h-full bg-hs-blue rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-hs-text-secondary text-center">{t("extractingOcr", "Extracting text with OCR...")}</p>
      </div>
    </div>
  );
}

function ResultsState({ imageUrl, result, onSave }: { imageUrl: string; result: ApiResult; onSave: () => void }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-hs-text">{t("prescriptionExplained", "Your Prescription Explained")}</h2>
        <ReadAloudButton text={result.explanation} />
      </div>

      <button onClick={() => setShowOriginal(!showOriginal)} className="btn-secondary w-full text-sm py-3">
        {showOriginal ? t("hideOriginal", "Hide original") : t("viewOriginal", "View original handwriting")}
      </button>
      {showOriginal && (
        <img src={imageUrl} alt="Original prescription" className="w-full rounded-2xl shadow-soft" />
      )}

      {result.ocrText && (
        <div className="hs-card bg-gray-50">
          <button className="w-full flex justify-between items-center text-sm" onClick={() => setShowOcr(!showOcr)}>
            <span className="font-semibold text-gray-700">{t("rawOcrText", "Raw OCR Text")}</span>
            <span className="text-gray-400 text-xs">{Math.round(result.ocrConfidence * 100)}% confidence {showOcr ? "▲" : "▼"}</span>
          </button>
          {showOcr && <p className="mt-2 text-xs text-gray-500 font-mono leading-relaxed">{result.ocrText}</p>}
        </div>
      )}

      <div className="hs-card space-y-3">
        <h3 className="font-semibold text-hs-text mb-1">{t("aiExplanation", "AI Explanation")}</h3>
        <TranslatableText text={result.explanation} originalText={result.explanationEn} />
      </div>

      <div className="bg-hs-red-light border border-hs-red/20 rounded-2xl p-4">
        <h3 className="text-base font-bold text-hs-red mb-3">{t("whenToSeeDoctorAgain", "When to See Doctor Again")}</h3>
        <p className="text-sm font-semibold text-hs-text mb-2">{t("callEmergency", "Call 108 or go to hospital immediately if:")}</p>
        <ul className="space-y-2">
          {URGENT_SYMPTOMS_KEYS.map((k, i) => (
            <li key={k} className="flex items-start gap-2 text-sm text-hs-text">
              <span className="text-hs-red mt-0.5">🔴</span>{t(k, URGENT_SYMPTOMS_FALLBACK[i])}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 pb-4">
        <button onClick={onSave} className="btn-secondary w-full py-4">{t("savePrescription", "Save Prescription")}</button>
      </div>

      <p className="text-xs text-hs-text-secondary text-center leading-relaxed pb-2">
        {t("aiAssistedReading", "AI-assisted reading. Always follow your doctor's actual instructions.")}
      </p>
    </div>
  );
}

export default function PrescriptionReader() {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const hasApi = !!import.meta.env.VITE_API_BASE_URL;
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Await translation: translate English explanation to user's language before showing results
  const translateText = async (text: string) =>
    lang !== "en" ? freeTranslate(text, lang, "en").catch(() => text) : text;

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleFile = async (f: File) => {
    setImageUrl(URL.createObjectURL(f));
    setState("processing");

    if (!hasApi) {
      try {
        console.log("[PrescriptionReader] Starting OCR for file:", f.name, f.size, "bytes");
        const ocrText = await ocrExtractText(f);
        console.log("[PrescriptionReader] OCR text:", ocrText.slice(0, 200));
        const names = extractMedicineNames(ocrText);
        console.log("[PrescriptionReader] Detected medicines:", names);
        const explanation = names.length > 0
          ? `Your prescription contains:\n\n${names.map((n, i) => `${i + 1}. ${n} — Please follow your doctor's instructions for dosage and duration.`).join("\n\n")}\n\nAlways complete the full course of any antibiotics prescribed. Contact your doctor if you experience side effects.`
          : `OCR extracted text:\n\n${ocrText}\n\nPlease show this to your doctor or pharmacist for detailed explanation.`;
        const translated = await translateText(explanation);
        setResult({
          explanation: translated,
          explanationEn: explanation,
          ocrText,
          ocrConfidence: 0.85,
          keyValues: Object.fromEntries(names.map((n, i) => [`Medicine ${i + 1}`, n])),
          model: "OCR.space",
        });
        saveScan({ type: "prescription", title: names[0] || "Prescription", summary: explanation.slice(0, 150), data: { explanation, medicines: names } });
        // Bridge: queue anonymous prescription data
        addToBridgeQueue("prescription_read", names, { medicineCount: names.length });
      } catch (err) {
        console.error("[PrescriptionReader] Error:", err);
        const errMsg = "Could not read the prescription. Please ensure the image is clear and try again.";
        const translatedErr = await translateText(errMsg);
        setResult({
          explanation: translatedErr,
          explanationEn: errMsg,
          ocrText: "",
          ocrConfidence: 0,
          keyValues: {},
          model: "error",
        });
      }
      setState("results");
      return;
    }

    try {
      const s3Key = await uploadFileForAnalysis(f, "uploads/prescription");
      const data = await readPrescription(s3Key, "en");
      const explanation = data.explanation || "Could not generate explanation.";
      const translated = await translateText(explanation);
      setResult({
        explanation: translated,
        explanationEn: explanation,
        ocrText: data.ocrText || "",
        ocrConfidence: data.ocrConfidence || 0,
        keyValues: data.keyValues || {},
        model: data.model || "bedrock",
        fallback: data.fallback,
      });
      setState("results");
    } catch {
      // AWS failed — fall back to free OCR
      try {
        const ocrText = await ocrExtractText(f);
        const names = extractMedicineNames(ocrText);
        const explanation = names.length > 0
          ? `Your prescription contains:\n\n${names.map((n, i) => `${i + 1}. ${n} \u2014 Follow your doctor's dosage instructions.`).join("\n\n")}\n\nComplete any antibiotic course fully. Contact your doctor if you experience side effects.`
          : `OCR extracted text:\n\n${ocrText}\n\nPlease show this to your doctor or pharmacist for explanation.`;
        const translated = await translateText(explanation);
        setResult({ explanation: translated, explanationEn: explanation, ocrText, ocrConfidence: 0.75, keyValues: Object.fromEntries(names.map((n, i) => [`Medicine ${i + 1}`, n])), model: "OCR.space" });
      } catch {
        const errMsg = "Could not read the prescription. Please ensure the image is clear and try again.";
        const translatedErr = await translateText(errMsg);
        setResult({ explanation: translatedErr, explanationEn: errMsg, ocrText: "", ocrConfidence: 0, keyValues: {}, model: "error", fallback: true });
      }
      setState("results");
    }
  };

  return (
    <div className="min-h-full bg-hs-bg">
      <div className="sticky top-0 z-10 bg-white border-b border-hs-border px-4 h-14 flex items-center justify-between">
        <button onClick={() => state === "upload" ? navigate(-1) : setState("upload")} className="btn-icon border-0 hover:bg-hs-bg">
          <svg className="w-5 h-5 text-hs-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-hs-text">{t("prescriptionReaderTitle", "Prescription Reader")}</h1>
        <span className="badge-info text-xs">{t("ocrPlusAI", "OCR + AI")}</span>
      </div>

      {state === "upload" && <UploadState onFile={handleFile} isOnline={isOnline} />}
      {state === "processing" && imageUrl && <ProcessingState imageUrl={imageUrl} />}
      {state === "results" && imageUrl && result && (
        <ResultsState imageUrl={imageUrl} result={result} onSave={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} />
      )}

      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-hs-green text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold animate-slide-up z-50">
          {t("prescriptionSaved", "Prescription saved")}
        </div>
      )}
    </div>
  );
}
