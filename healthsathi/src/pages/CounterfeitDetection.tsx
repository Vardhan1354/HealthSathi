import { useState, useEffect } from "react";
import { verifyMedicine } from "../services/api";
import type { VerifyMedicineResponse } from "../services/api";
import MicButton from "../components/MicButton";
import ReadAloudButton from "../components/ReadAloudButton";
import CameraCapture from "../components/CameraCapture";
import { ocrExtractText, extractMedicineNames, checkDrugRecall } from "../services/freeApis";
import type { RecallResult } from "../services/freeApis";
import { useTranslation } from "react-i18next";
import { addToBridgeQueue } from "../services/storage";
import { freeTranslate } from "../services/freeTranslate";

type ScanState = "upload" | "processing" | "results";
type CheckStatus = "pass" | "fail" | "warn";

interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
}

function recallToChecks(r: RecallResult | null): Check[] {
  if (!r) return [{ label: "FDA Database", status: "warn", detail: "Could not connect to FDA database. Verify manually." }];
  if (!r.recalled) {
    return [
      { label: "FDA Recall Database", status: "pass", detail: "No active recall found for this medicine" },
      { label: "OpenFDA Status", status: "pass", detail: `Status: ${r.status}` },
      { label: "Verified Date", status: "pass", detail: r.date !== "—" ? `Last checked: ${r.date}` : "Checked against current database" },
    ];
  }
  return [
    { label: "FDA Recall Alert", status: "fail", detail: r.reason.slice(0, 120) },
    { label: "Recall Date", status: "fail", detail: `Initiated: ${r.date}` },
    { label: "Product Match", status: "warn", detail: r.product.slice(0, 120) },
    { label: "Recall Status", status: r.status === "Completed" ? "warn" : "fail", detail: `Enforcement status: ${r.status}` },
  ];
}

function getVerdictFromRecall(r: RecallResult | null): "genuine" | "suspicious" | "counterfeit" {
  if (!r) return "suspicious";
  if (!r.recalled) return "genuine";
  return r.status === "Completed" ? "suspicious" : "counterfeit";
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <span className="text-green-600 font-bold">✅</span>;
  if (status === "fail") return <span className="text-red-600 font-bold">❌</span>;
  return <span className="text-yellow-500 font-bold">⚠️</span>;
}

const verdictCfg = {
  genuine: { bg: "bg-green-50 border-green-400", icon: "✅", title: "Genuine Medicine", sub: "This medicine appears authentic.", btn: "bg-green-600" },
  suspicious: { bg: "bg-yellow-50 border-yellow-400", icon: "⚠️", title: "Suspicious — Verify Again", sub: "Some checks failed. Ask your chemist.", btn: "bg-yellow-600" },
  counterfeit: { bg: "bg-red-50 border-red-400", icon: "❌", title: "Possibly Counterfeit", sub: "Do NOT use. Contact CDSCO helpline: 1800-180-3024", btn: "bg-red-600" },
};

export default function CounterfeitDetection() {
  const [state, setState] = useState<ScanState>("upload");
  const [progress, setProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [barcode, setBarcode] = useState("");
  const [apiResult, setApiResult] = useState<VerifyMedicineResponse | null>(null);
  const [freeChecks, setFreeChecks] = useState<Check[] | null>(null);
  const [freeVerdict, setFreeVerdict] = useState<"genuine" | "suspicious" | "counterfeit">("genuine");
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
    setApiResult(null);
    setFreeChecks(null);
    setProgress(20);

    if (import.meta.env.VITE_API_BASE_URL && barcode.trim()) {
      // AWS path — fall back to free OCR if AWS fails
      try {
        const result = await verifyMedicine(barcode.trim(), undefined, { hasHologram: true });
        setApiResult(result);
        setProgress(100);
        setState("results");
        return;
      } catch {
        // AWS failed — continue to free path below
      }
    }

    // Free path: OCR to get medicine name, then OpenFDA recall check
    let localChecks: Check[] = [];
    let localVerdict: "genuine" | "suspicious" | "counterfeit" = "suspicious";
    try {
      setProgress(40);
      let query = barcode.trim();
      if (!query) {
        const ocrText = await ocrExtractText(file);
        const names = extractMedicineNames(ocrText);
        query = names[0] ?? ocrText.split("\n")[0]?.slice(0, 40) ?? "";
      }
      setProgress(70);
      if (query) {
        const recall = await checkDrugRecall(query);
        localChecks = recallToChecks(recall);
        localVerdict = getVerdictFromRecall(recall);
      } else {
        localChecks = [{ label: "Image Analysis", status: "warn", detail: "Could not extract medicine name. Enter barcode manually for accurate check." }];
        localVerdict = "suspicious";
      }
    } catch {
      localChecks = [{ label: "FDA Check", status: "warn", detail: "Could not complete check. Please try again with a clearer image." }];
      localVerdict = "suspicious";
    }
    setFreeChecks(localChecks);
    setFreeVerdict(localVerdict);
    setProgress(100);
    addToBridgeQueue("counterfeit_check", [barcode.trim() || "image-scan"], { verdict: localVerdict });
    // Translate check details BEFORE showing results so output is already in user's language
    if (lang !== "en" && localChecks.length > 0) {
      try {
        const translated = await Promise.all(localChecks.map(async c => ({
          ...c,
          label: await translate(c.label),
          detail: await translate(c.detail),
        })));
        setFreeChecks(translated);
      } catch {
        // Keep English checks on translation failure
      }
    }
    setState("results");
  }

  if (state === "upload") {
    return (
      <div className="p-4 space-y-6 animate-fade-in">
        <div className="hs-card text-center">
          <div className="text-5xl mb-3">💊</div>
          <h2 className="text-xl font-bold text-hs-blue-900 mb-1">{t("checkMedicine", "Check Medicine")}</h2>
          <p className="text-gray-500 text-sm mb-6">{t("verifyWithAI", "Verify if your medicine is genuine using AI")}</p>
          {!isOnline && (
            <div className="hs-card bg-yellow-50 border-2 border-yellow-400 text-center mb-4">
              <p className="text-2xl mb-1">📡</p>
              <p className="font-bold text-yellow-800">{t("noInternet", "No Internet Connection")}</p>
              <p className="text-sm text-yellow-700 mt-1">{t("connectToVerify")}</p>
            </div>
          )}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              className="flex-1 border border-hs-border rounded-xl px-4 py-2 text-sm text-hs-text focus:outline-none focus:ring-2 focus:ring-hs-blue/40"
              placeholder={t("enterBarcode", "Enter barcode (optional — improves accuracy)")}
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
            />
            <MicButton onResult={text => setBarcode(text)} className="flex-shrink-0" />
          </div>
          <CameraCapture
            onCapture={handleFile}
            onGallery={handleFile}
            disabled={!isOnline}
          />
        </div>
        <div className="hs-card bg-blue-50 border border-blue-200">
          <p className="font-semibold text-blue-800 mb-2">{t("howToGoodPhoto")}</p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li><strong>{t("photoBackStrip")}</strong></li>
            <li>{t("placeBrightLight")}</li>
            <li>{t("includeHologram")}</li>
            <li>{t("barcodeAccuracy")}</li>
          </ul>
        </div>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="hs-card text-center">
          {imageUrl && <img src={imageUrl} alt="Medicine" className="w-32 h-32 object-cover rounded-xl mx-auto mb-4 border-2 border-hs-blue-200" />}
          <p className="font-semibold text-hs-blue-900 mb-4">{t("analysingMedicine", "🔍 Analysing medicine...")}</p>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div className="bg-hs-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-gray-500">{progress}{t("percentComplete", "% complete")}</p>
        </div>
      </div>
    );
  }

  // Use API result checks if available, else use OpenFDA free checks, else warn
  const activeChecks: Check[] = apiResult
    ? apiResult.checks.map(c => ({
        label: c.label,
        status: c.status,
        detail: c.detail,
      }))
    : freeChecks ?? [{ label: "Awaiting scan", status: "warn", detail: "No result available" }];
  const verdict = apiResult
    ? (apiResult.verdict as "genuine" | "suspicious" | "counterfeit")
    : freeVerdict;
  const cfg = verdictCfg[verdict];
  const verdictTitle = t(`verdict_${verdict}_title`, cfg.title);
  const verdictSub = t(`verdict_${verdict}_sub`, cfg.sub);
  const verdictText = `${verdictTitle}. ${verdictSub} ${activeChecks.map(c => c.label + ": " + c.detail).join(". ")}`;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {apiResult && (
        <div className="text-xs text-center text-hs-text-secondary -mb-2">{t("verifiedCDSCO")}</div>
      )}
      <div className={`hs-card border-2 ${cfg.bg} text-center`}>
        <div className="text-4xl mb-2">{cfg.icon}</div>
        <h2 className="text-xl font-bold">{verdictTitle}</h2>
        <p className="text-sm text-gray-600 mt-1">{verdictSub}</p>
        <div className="mt-3 flex justify-center">
          <ReadAloudButton text={verdictText} />
        </div>
      </div>
      <div className="hs-card space-y-3">
        <h3 className="font-semibold text-hs-blue-900">{t("authenticityChecks", "Authenticity Checks")}</h3>
        {activeChecks.map((c, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <StatusIcon status={c.status} />
            <div>
              <p className="font-medium text-sm">{c.label}</p>
              <p className="text-xs text-gray-500">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-secondary w-full" onClick={() => { setState("upload"); setImageUrl(null); setApiResult(null); setBarcode(""); setFreeChecks(null); setFreeVerdict("genuine"); }}>
        {t("scanAnotherMedicineBtn", "🔍 Scan Another Medicine")}
      </button>
    </div>
  );
}
