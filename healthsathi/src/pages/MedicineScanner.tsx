import { useState, useEffect } from "react";
import TranslatableText from "../components/TranslatableText";
import ReadAloudButton from "../components/ReadAloudButton";
import CameraCapture from "../components/CameraCapture";
import { ocrExtractText, lookupMedicineInfo, extractMedicineNames, buildMedicineScanExplanation } from "../services/freeApis";
import { useTranslation } from "react-i18next";
import { freeTranslate } from "../services/freeTranslate";
import { saveScan, addToBridgeQueue } from "../services/storage";

type ScanState = "upload" | "processing" | "results" | "error";

const STEPS = ["Uploading image", "Detecting label", "Reading text with AI", "Generating explanation"];

interface ScanResult {
  explanation: string;
  explanationEn: string;
  detectedLabels: string[];
  detectedText: string[];
  model: string;
}

export default function MedicineScanner() {
  const [state, setState] = useState<ScanState>("upload");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const hasApi = false; // MedicineScanner always uses free OCR.space + OpenFDA (no AWS)

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (state !== "processing") return;
    const iv = setInterval(() => {
      setProgress(prev => {
        const next = prev + 3;
        setCurrentStep(Math.min(3, Math.floor(next / 25)));
        return Math.min(90, next);
      });
    }, 250);
    return () => clearInterval(iv);
  }, [state]);

  async function handleFile(file: File) {
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);
    setProgress(0);
    setCurrentStep(0);
    setState("processing");

    // Always use free APIs: OCR.space + OpenFDA + RxNorm (no AWS)
    try {
      console.log("[MedicineScanner] Starting OCR for file:", file.name, file.size, "bytes");
      const ocrText = await ocrExtractText(file);
      console.log("[MedicineScanner] OCR text:", ocrText.slice(0, 200));
      const names = extractMedicineNames(ocrText);
      console.log("[MedicineScanner] Detected medicines:", names);
      const fdaInfo = names[0] ? await lookupMedicineInfo(names[0]) : null;
      console.log("[MedicineScanner] FDA info:", fdaInfo ? "found" : "not found");
      const rawExplanation = buildMedicineScanExplanation(ocrText, fdaInfo);
      setProgress(100);
      // Translate before showing results so output is in selected language
      const translated = lang !== "en"
        ? await freeTranslate(rawExplanation, lang, "en").catch(() => rawExplanation)
        : rawExplanation;
      setResult({ explanation: translated, explanationEn: rawExplanation, detectedLabels: [], detectedText: names.length > 0 ? names : ocrText.split("\n").slice(0, 3), model: "OCR.space + OpenFDA" });
      setState("results");
      // Save to localStorage
      saveScan({ type: "medicine", title: names[0] || "Medicine Scan", summary: rawExplanation.slice(0, 150), data: { explanation: rawExplanation, detectedText: names } });
      // Bridge: queue anonymous medicine scan data for doctor dashboard
      addToBridgeQueue("medicine_scan", names, { source: "ocr.space+openfda" });
    } catch (err) {
      console.error("[MedicineScanner] Error:", err);
      setProgress(100);
      const errMsg = "Could not read the medicine label. Please ensure the image is clear and well-lit, then try again.";
      const translatedErr = lang !== "en"
        ? await freeTranslate(errMsg, lang, "en").catch(() => errMsg)
        : errMsg;
      setResult({ explanation: translatedErr, explanationEn: errMsg, detectedLabels: [], detectedText: [], model: "error" });
      setState("results");
    }
  }

  const reset = () => {
    setState("upload");
    setImageUrl(null);
    setProgress(0);
    setResult(null);
  };

  if (state === "upload") {
    return (
      <div className="p-4 space-y-6 animate-fade-in">
        <div className="hs-card text-center">
          <div className="text-6xl mb-3">💊</div>
          <h2 className="text-xl font-bold text-hs-blue-900 mb-1">{t("scanMedicineTitle", "Scan Medicine")}</h2>
          <p className="text-gray-500 text-sm mb-6">📷 {t("medicineScannerDescription", "Photograph the BACK of the medicine strip/packet — where composition, batch number, and expiry date are printed")}</p>
          {!isOnline && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-3 mb-4 text-center">
              <p className="text-2xl mb-1">📡</p>
              <p className="font-bold text-yellow-800">{t("noInternet", "No Internet Connection")}</p>
              <p className="text-sm text-yellow-700 mt-1">{t("connectToScan", "Connect to Wi-Fi to scan medicines. Will work when internet returns.")}</p>
            </div>
          )}
          <CameraCapture
            onCapture={handleFile}
            onGallery={handleFile}
            disabled={!isOnline}
          />
        </div>
        <div className="hs-card bg-amber-50 border border-amber-200">
          <p className="font-semibold text-amber-800 mb-2">{t("tipsForBestResults", "Tips for best results")}</p>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li><strong>{t("holdBack")}</strong></li>
            <li>{t("holdSteady", "Hold phone steady in good light")}</li>
            <li>{t("captureName", "Capture the full medicine name and batch number")}</li>
            <li>{t("avoidGlare", "Avoid glare and shadows")}</li>
          </ul>
        </div>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="hs-card text-center">
          {imageUrl && (
            <img src={imageUrl} alt="Medicine" className="w-36 h-36 object-cover rounded-2xl mx-auto mb-4 border-2 border-hs-blue-200" />
          )}
          <p className="font-bold text-hs-blue-900 text-lg mb-1">{t("scanningWithAI", "Scanning with AI...")}</p>
          <p className="text-sm text-hs-blue-600 mb-4">{STEPS[currentStep]}</p>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
            <div className="bg-hs-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-around mt-2">
            {STEPS.map((_s, i) => (
              <span key={i} className={`text-xs font-medium ${i <= currentStep ? "text-hs-blue-600" : "text-gray-400"}`}>
                {i <= currentStep ? "✓" : "○"}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">{hasApi ? "Amazon Rekognition + Bedrock" : "OCR + OpenFDA"}</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="hs-card">
        <div className="flex items-start gap-3">
          {imageUrl && (
            <img src={imageUrl} alt="Medicine" className="w-16 h-16 object-cover rounded-xl border border-gray-200 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-hs-blue-900 text-lg leading-tight">{t("medicineScanResult", "Medicine Scan Result")}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t("poweredBy", "Powered by")} {result.model}</p>
            {result.detectedText.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{t("detected", "Detected")}: {result.detectedText.slice(0, 5).join(", ")}</p>
            )}
          </div>
          <ReadAloudButton text={result.explanation} className="flex-shrink-0" />
        </div>
      </div>

      <div className="hs-card space-y-3">
        <h3 className="font-semibold text-hs-blue-900 mb-2">{t("aiAnalysis", "AI Analysis")}</h3>
        <TranslatableText text={result.explanation} originalText={result.explanationEn} />
      </div>

      {result.detectedLabels.length > 0 && (
        <div className="hs-card bg-gray-50">
          <p className="text-xs font-semibold text-gray-600 mb-2">{t("labelsDetected", "Labels detected by Rekognition")}</p>
          <div className="flex flex-wrap gap-1.5">
            {result.detectedLabels.map(l => (
              <span key={l} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">{l}</span>
            ))}
          </div>
        </div>
      )}

      <button className="btn-secondary w-full" onClick={reset}>
        {t("scanAnotherMedicine", "📸 Scan Another Medicine")}
      </button>

      <p className="text-xs text-gray-400 text-center leading-relaxed pb-2">
        {t("aiAssistedScan", "AI-assisted scan. Always verify with pharmacist and follow doctor advice.")}
      </p>
    </div>
  );
}
