import { useState, useEffect } from "react";
import { uploadFileForAnalysis, explainReport } from "../services/api";
import TranslatableText from "../components/TranslatableText";
import ReadAloudButton from "../components/ReadAloudButton";
import { ocrExtractText, parseLabReport } from "../services/freeApis";
import { useTranslation } from "react-i18next";
import { freeTranslate } from "../services/freeTranslate";
import { saveScan, addToBridgeQueue } from "../services/storage";

type ScanState = "upload" | "processing" | "results";
type TestStatus = "normal" | "mild" | "critical";

interface LabTest {
  testName: string;
  value: string;
  unit: string;
  normalRange: string;
  status: TestStatus;
  explanation: string;
}

interface ApiResult {
  explanation: string;
  explanationEn: string;
  model: string;
  fallback?: boolean;
}

const REFERENCE_TESTS: LabTest[] = [
  { testName: "Haemoglobin", value: "—", unit: "g/dL", normalRange: "12-16 (F), 13-17 (M)", status: "normal", explanation: "Measures iron-rich protein in red blood cells. Low levels indicate anaemia." },
  { testName: "Total WBC Count", value: "—", unit: "x10^3/uL", normalRange: "4-11", status: "normal", explanation: "White blood cells fight infection. High count may indicate infection or inflammation." },
  { testName: "Platelets", value: "—", unit: "x10^3/uL", normalRange: "150-400", status: "normal", explanation: "Help blood clot. Low count (thrombocytopenia) can cause bleeding." },
  { testName: "Fasting Blood Sugar", value: "—", unit: "mg/dL", normalRange: "70-100", status: "normal", explanation: "Blood glucose level when fasting. Values above 126 may indicate diabetes." },
  { testName: "Creatinine", value: "—", unit: "mg/dL", normalRange: "0.6-1.2", status: "normal", explanation: "Kidney waste product. High levels may indicate kidney problems." },
];

const STATUS_STYLE: Record<TestStatus, { pill: string; icon: string; bar: string }> = {
  normal:   { pill: "badge-success", icon: "✓", bar: "bg-hs-green" },
  mild:     { pill: "badge-warning", icon: "!", bar: "bg-hs-yellow" },
  critical: { pill: "badge-danger",  icon: "!!", bar: "bg-hs-red" },
};

export default function LabReports() {
  const [state, setState] = useState<ScanState>("upload");
  const [progress, setProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const hasApi = !!import.meta.env.VITE_API_BASE_URL;
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const translate = (text: string) =>
    lang !== "en" ? freeTranslate(text, lang, "en").catch(() => text) : Promise.resolve(text);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function handleFile(file: File) {
    setImageUrl(URL.createObjectURL(file));
    setState("processing");
    setProgress(0);

    // Tick progress while processing
    const ticker = setInterval(() => setProgress(prev => Math.min(prev + 5, 85)), 400);

    if (!hasApi) {
      try {
        console.log("[LabReports] Starting OCR for file:", file.name, file.size, "bytes");
        const ocrText = await ocrExtractText(file);
        console.log("[LabReports] OCR text:", ocrText.slice(0, 200));
        const parsed = parseLabReport(ocrText);
        console.log("[LabReports] Parsed tests:", parsed.length, parsed.map(t => t.name));
        let explanation = "";
        if (parsed.length > 0) {
          const abnormal = parsed.filter(t => t.status !== "normal");
          explanation = `Lab Report Summary:\n\n${parsed.map(t => {
            const statusText = t.status === "normal" ? "Within normal range" : t.status === "mild" ? "Slightly outside normal range — monitor" : "Significantly outside normal range — consult doctor";
            return `${t.name}: ${t.value} ${t.unit} (Normal: ${t.normalRange}) — ${t.status.toUpperCase()}\n${statusText}`;
          }).join("\n\n")}`;
          if (abnormal.length > 0) {
            explanation += `\n\nIMPORTANT: ${abnormal.length} value${abnormal.length > 1 ? "s are" : " is"} outside the normal range. Please consult your doctor.`;
          }
        } else {
          explanation = `Extracted from your report:\n\n${ocrText}\n\nWe could not automatically interpret all values. Please share this with your doctor.`;
        }
        clearInterval(ticker);
        setProgress(100);
        const translatedExplanation = await translate(explanation);
        setApiResult({ explanation: translatedExplanation, explanationEn: explanation, model: "OCR.space", fallback: false });
        saveScan({ type: "lab-report", title: "Lab Report", summary: explanation.slice(0, 150), data: { explanation } });
        // Bridge: queue anonymous lab report data
        addToBridgeQueue("lab_report", parsed.map(t => t.name), { abnormalCount: parsed.filter(t => t.status !== "normal").length });
      } catch (err) {
        console.error("[LabReports] Error:", err);
        clearInterval(ticker);
        setProgress(100);
        const errMsg = "Could not read the lab report. Please ensure the image is clear and try again.";
        setApiResult({ explanation: await translate(errMsg), explanationEn: errMsg, model: "error", fallback: true });
      }
      setState("results");
      return;
    }

    const awsTicker = setInterval(() => setProgress(prev => Math.min(prev + 8, 85)), 400);
    try {
      const s3Key = await uploadFileForAnalysis(file, "uploads/lab-report");
      const data = await explainReport(s3Key, "lab_report", "en");
      clearInterval(awsTicker);
      setProgress(100);
      const rawExpl = data.explanation || "";
      setApiResult({ explanation: await translate(rawExpl), explanationEn: rawExpl, model: data.model, fallback: data.fallback });
      setState("results");
    } catch {
      clearInterval(awsTicker);
      // AWS failed — fall back to free OCR + parseLabReport
      try {
        const ocrText = await ocrExtractText(file);
        const parsed = parseLabReport(ocrText);
        let explanation = "";
        if (parsed.length > 0) {
          const abnormal = parsed.filter(t => t.status !== "normal");
          explanation = `Lab Report Summary:\n\n${parsed.map(t => {
            const statusText = t.status === "normal" ? "Within normal range" : t.status === "mild" ? "Slightly outside normal range" : "Significantly outside normal range";
            return `${t.name}: ${t.value} ${t.unit} (Normal: ${t.normalRange}) \u2014 ${t.status.toUpperCase()}\n${statusText}`;
          }).join("\n\n")}`;
          if (abnormal.length > 0) explanation += `\n\nIMPORTANT: ${abnormal.length} value${abnormal.length > 1 ? "s are" : " is"} outside normal range. Please consult your doctor.`;
        } else {
          explanation = `Extracted from your report:\n\n${ocrText}\n\nWe could not automatically interpret all values. Please share this with your doctor.`;
        }
        setProgress(100);
        setApiResult({ explanation: await translate(explanation), explanationEn: explanation, model: "OCR.space", fallback: true });
      } catch {
        setProgress(100);
        const errMsg = "Could not read the lab report. Please ensure the image is clear and try again.";
        setApiResult({ explanation: await translate(errMsg), explanationEn: errMsg, model: "error", fallback: true });
      }
      setState("results");
    }
  }

  if (state === "upload") {
    return (
      <div className="p-4 space-y-6 animate-fade-in">
        <div className="hs-card text-center">
          <div className="text-5xl mb-3">🩸</div>
          <h2 className="text-xl font-bold text-hs-blue-900 mb-1">{t("uploadLabReportTitle", "Upload Lab Report")}</h2>
          <p className="text-gray-500 text-sm mb-6">{t("getExplanations", "Get plain-language explanations of your test results")}</p>
          {!isOnline && (
            <div className="hs-card bg-yellow-50 border-2 border-yellow-400 text-center mb-4">
              <p className="font-bold text-yellow-800">{t("noInternet")}</p>
              <p className="text-sm text-yellow-700 mt-1">{t("connectToAnalyze")}</p>
            </div>
          )}
          {/* File inputs - hidden but clickable via labels */}
          <input
            type="file"
            id="lab-camera-input"
            accept="image/*"
            capture="environment"
            style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", border: 0 }}
            onChange={e => { console.log("[LabReports] Camera file:", e.target.files?.[0]?.name); e.target.files?.[0] && handleFile(e.target.files[0]); e.target.value = ""; }}
          />
          <label
            htmlFor="lab-camera-input"
            className={"btn-primary block text-center " + (!isOnline ? "opacity-40 pointer-events-none" : "cursor-pointer")}
          >
            {t("takePhoto", "Take Photo")}
          </label>

          <input
            type="file"
            id="lab-gallery-input"
            accept="image/*"
            style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", border: 0 }}
            onChange={e => { console.log("[LabReports] Gallery file:", e.target.files?.[0]?.name); e.target.files?.[0] && handleFile(e.target.files[0]); e.target.value = ""; }}
          />
          <label
            htmlFor="lab-gallery-input"
            className="btn-secondary block text-center cursor-pointer mt-3"
          >
            {t("fromGallery", "From Gallery")}
          </label>
        </div>
        <div className="hs-card bg-blue-50 border border-blue-200">
          <p className="font-semibold text-blue-800 mb-2">{t("tipsTitle", "Tips")}</p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>{t("tipFullReport", "Ensure full report is visible in photo")}</li>
            <li>{t("tipGoodLight", "Good lighting helps accuracy")}</li>
            <li>{t("tipCommonFormats", "Supports most common blood test formats")}</li>
          </ul>
        </div>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="hs-card text-center">
          {imageUrl && <img src={imageUrl} alt="Report" className="w-32 h-32 object-cover rounded-xl mx-auto mb-4 border-2 border-hs-blue-200" />}
          <p className="text-sm text-gray-500">{t("analysingReport", "Analysing your report...")}</p>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div className="bg-hs-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-gray-500">{progress}% complete</p>
        </div>
      </div>
    );
  }

  // Results
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {apiResult?.explanation ? (
        <>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-hs-text">{t("labReportExplained", "Lab Report Explained")}</h2>
            <ReadAloudButton text={apiResult.explanation} />
          </div>
          <div className="hs-card space-y-3">
            <p className="text-xs text-gray-400">{t("poweredBy", "Powered by")} {apiResult.model}</p>
            <TranslatableText text={apiResult.explanation} originalText={apiResult.explanationEn} />
          </div>

          <button onClick={() => setShowGuide(!showGuide)} className="btn-secondary w-full text-sm">
            {showGuide ? t("hideNormalRanges", "Hide normal ranges guide") : t("showNormalRanges", "Show normal ranges guide")}
          </button>

          {showGuide && (
            <div className="space-y-3">
              {REFERENCE_TESTS.map((t, i) => {
                const s = STATUS_STYLE[t.status];
                return (
                  <div key={i} className="hs-card">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-semibold text-hs-blue-900">{t.testName}</p>
                      <span className={`${s.pill} text-xs flex items-center gap-1`}>{s.icon} {t.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-1">Normal: {t.normalRange}</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{t.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="hs-card text-center text-hs-text-secondary py-10">
          <p className="text-2xl mb-2">🩹</p>
          <p className="font-semibold">{t("uploadLabPrompt", "Upload a lab report to see results")}</p>
          <p className="text-sm mt-1">{t("clearPhotoReport", "Take a clear photo of your blood test report")}</p>
        </div>
      )}

      <button className="btn-secondary w-full" onClick={() => { setState("upload"); setImageUrl(null); setApiResult(null); }}>
        {t("uploadAnother", "Upload Another Report")}
      </button>

      <p className="text-xs text-gray-400 text-center pb-2">
        {t("aiAssistedInterpretation", "AI-assisted interpretation. Not a substitute for medical diagnosis.")}
      </p>
    </div>
  );
}
