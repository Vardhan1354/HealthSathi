import { useState } from "react";
import TranslatableText from "../components/TranslatableText";
import ReadAloudButton from "../components/ReadAloudButton";
import MicButton from "../components/MicButton";
import { useTranslation } from "react-i18next";
import { freeTranslate } from "../services/freeTranslate";
import { addToBridgeQueue } from "../services/storage";

type Severity = "high" | "moderate" | "low" | "safe";

interface Interaction {
  drugs: [string, string];
  severity: Severity;
  effect: string;
  action: string;
}

interface ApiInteraction {
  pair: string[];
  severity: "major" | "moderate" | "minor" | "none";
  effect: string;
  recommendation: string;
}

interface ApiResult {
  medicines: string[];
  overallRisk: "safe" | "caution" | "avoid";
  summary: string;
  interactions: ApiInteraction[];
  generalAdvice: string[];
  seeDoctor: boolean;
  fromCache: boolean;
}

const COMMON_DRUGS = [
  "Aspirin", "Ibuprofen", "Paracetamol", "Warfarin", "Metformin",
  "Amlodipine", "Atorvastatin", "Azithromycin", "Ciprofloxacin",
  "Omeprazole", "Metoprolol", "Diazepam",
];

const KNOWN_INTERACTIONS: Interaction[] = [
  { drugs: ["Aspirin", "Warfarin"], severity: "high", effect: "Increased bleeding risk", action: "Avoid combination. Consult doctor." },
  { drugs: ["Ibuprofen", "Warfarin"], severity: "high", effect: "Serious bleeding risk", action: "Avoid. Use Paracetamol instead." },
  { drugs: ["Aspirin", "Ibuprofen"], severity: "moderate", effect: "Reduced aspirin effectiveness", action: "Take at different times. Ask doctor." },
  { drugs: ["Metformin", "Ciprofloxacin"], severity: "moderate", effect: "Risk of low blood sugar", action: "Monitor blood sugar closely." },
  { drugs: ["Atorvastatin", "Azithromycin"], severity: "moderate", effect: "Increased muscle pain risk", action: "Watch for muscle aches. Report to doctor." },
  { drugs: ["Diazepam", "Metoprolol"], severity: "low", effect: "Possible increased sedation", action: "Avoid driving. Monitor carefully." },
  { drugs: ["Amlodipine", "Atorvastatin"], severity: "low", effect: "Slightly increased statin levels", action: "Usually safe. Regular follow-up." },
];

function getMockInteractions(selected: string[]): Array<{ pair: [string, string]; interaction: Interaction | null }> {
  const results: Array<{ pair: [string, string]; interaction: Interaction | null }> = [];
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const a = selected[i], b = selected[j];
      const found = KNOWN_INTERACTIONS.find(
        x => (x.drugs[0] === a && x.drugs[1] === b) || (x.drugs[0] === b && x.drugs[1] === a)
      );
      results.push({ pair: [a, b], interaction: found ?? null });
    }
  }
  return results;
}

// ─── Free API: NIH RxNorm + NLM Drug Interaction API ────────────────────────

async function getRxCUI(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.idGroup?.rxnormId?.[0] ?? null;
  } catch {
    return null;
  }
}

function mapNlmSeverity(s: string): "major" | "moderate" | "minor" | "none" {
  const l = (s || "").toLowerCase();
  if (l.includes("major") || l.includes("high")) return "major";
  if (l.includes("moderate")) return "moderate";
  if (l.includes("minor") || l.includes("low")) return "minor";
  return "none";
}

function buildLocalFallbackResult(drugs: string[]): ApiResult {
  const pairs = getMockInteractions(drugs);
  const interactions: ApiInteraction[] = pairs
    .filter(p => p.interaction !== null)
    .map(p => ({
      pair: p.pair as string[],
      severity: p.interaction!.severity === "high" ? "major" : p.interaction!.severity === "moderate" ? "moderate" : "minor",
      effect: p.interaction!.effect,
      recommendation: p.interaction!.action,
    }));
  const hasHigh = interactions.some(i => i.severity === "major");
  const hasMod  = interactions.some(i => i.severity === "moderate");
  return {
    medicines: drugs,
    overallRisk: hasHigh ? "avoid" : hasMod ? "caution" : "safe",
    summary: interactions.length === 0
      ? "No known interactions found in local database."
      : `${interactions.length} interaction(s) found.`,
    interactions,
    generalAdvice: ["Always consult a doctor before combining medicines."],
    seeDoctor: hasHigh,
    fromCache: false,
  };
}

async function checkWithRxNorm(drugs: string[]): Promise<ApiResult> {
  // Step 1: Resolve RxCUI for each drug name
  const cuiList = await Promise.all(drugs.map(getRxCUI));
  const validCuis = cuiList.filter((c): c is string => c !== null);

  if (validCuis.length < 2) {
    return buildLocalFallbackResult(drugs);
  }

  // Step 2: Try NLM list endpoint, then per-drug endpoint, then local fallback
  // NLM RxNorm Interaction API (free, no key) — try multiple URL formats
  const listUrls = [
    `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${validCuis.join("%20")}`,
    `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${validCuis.join("+")}`,
  ];
  let res: Response | null = null;
  for (const url of listUrls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (r.ok) { res = r; break; }
    } catch { /* try next */ }
  }
  if (!res) return buildLocalFallbackResult(drugs);
  try {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const apiInteractions: ApiInteraction[] = [];
    let worst: "major" | "moderate" | "minor" | "none" = "none";

    for (const group of data.fullInteractionTypeGroup ?? []) {
      for (const type of group.fullInteractionType ?? []) {
        for (const ipair of type.interactionPair ?? []) {
          const sev = mapNlmSeverity(ipair.severity ?? "");
          if (sev === "major") worst = "major";
          else if (sev === "moderate" && worst !== "major") worst = "moderate";
          else if (sev === "minor" && worst === "none") worst = "minor";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const names: string[] = (ipair.interactionConcept ?? []).map((c: any) =>
            c.minConceptItem?.name ?? "Unknown"
          );
          const recommendation =
            sev === "major"   ? "Avoid this combination. Consult your doctor immediately." :
            sev === "moderate" ? "Use with caution and consult your doctor." :
            "Generally safe but monitor for any unusual symptoms.";

          apiInteractions.push({
            pair: names,
            severity: sev === "none" ? "none" : sev,
            effect: ipair.description ?? "Possible interaction.",
            recommendation,
          });
        }
      }
    }

    const overallRisk = worst === "major" ? "avoid" : worst === "moderate" ? "caution" : "safe";
    const summary = apiInteractions.length === 0
      ? "No significant interactions found between these medicines (via NIH RxNorm)."
      : `${apiInteractions.length} interaction${apiInteractions.length > 1 ? "s" : ""} found. ${
          worst === "major" ? "⚠️ HIGH RISK — consult your doctor." :
          worst === "moderate" ? "Use with caution." : "Low risk — monitor for symptoms."
        }`;

    return {
      medicines: drugs,
      overallRisk,
      summary,
      interactions: apiInteractions,
      generalAdvice: [
        "Always tell your doctor about all medicines you take.",
        "Do not stop or change medicines without medical advice.",
        "Report unusual side effects to your healthcare provider.",
      ],
      seeDoctor: worst === "major" || worst === "moderate",
      fromCache: false,
    };
  } catch {
    return buildLocalFallbackResult(drugs);
  }
}

const SEV_STYLE: Record<string, string> = {
  high: "bg-red-50 border-red-400",
  major: "bg-red-50 border-red-400",
  moderate: "bg-yellow-50 border-yellow-400",
  low: "bg-green-50 border-green-400",
  minor: "bg-green-50 border-green-400",
  none: "border-gray-200",
};
const SEV_LABEL: Record<string, string> = {
  high: "High Risk",
  major: "Major Risk",
  moderate: "Moderate",
  low: "Low Risk",
  minor: "Minor",
  none: "No Interaction",
};

const RISK_BADGE: Record<string, string> = {
  safe: "badge-success",
  caution: "badge-warning",
  avoid: "badge-danger",
};

export default function InteractionChecker() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const hasApi = false; // InteractionChecker always uses NIH RxNorm free API — not AWS Bedrock
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Auto-translate ApiResult summary+advice when user language isn't English
  async function translateAndSet(data: ApiResult) {
    if (lang === "en") { setApiResult(data); return; }
    try {
      const [summary, ...advices] = await Promise.all([
        freeTranslate(data.summary, lang, "en").catch(() => data.summary),
        ...data.generalAdvice.map(a => freeTranslate(a, lang, "en").catch(() => a)),
      ]);
      setApiResult({ ...data, summary, generalAdvice: advices });
    } catch {
      setApiResult(data);
    }
  }

  function toggle(drug: string) {
    setChecked(false);
    setApiResult(null);
    setSelected(prev =>
      prev.includes(drug) ? prev.filter(d => d !== drug) : prev.length < 5 ? [...prev, drug] : prev
    );
  }

  function addCustom() {
    const val = customInput.trim();
    if (!val || selected.length >= 5 || selected.includes(val)) return;
    setSelected(prev => [...prev, val]);
    setCustomInput("");
    setChecked(false);
    setApiResult(null);
  }

  async function handleCheck() {
    if (selected.length < 2) return;
    setLoading(true);
    setError("");
    setApiResult(null);

    if (!hasApi) {
      // Use NIH RxNorm free API (no key required)
      try {
        const data = await checkWithRxNorm(selected);
        await translateAndSet(data);
        setChecked(true);
      } catch (err: unknown) {
        console.error("[InteractionChecker RxNorm]", err);
        await translateAndSet(buildLocalFallbackResult(selected));
        setChecked(true);
      }
      // Bridge: queue anonymous interaction check data
      addToBridgeQueue("interaction_check", selected, { medicineCount: selected.length });
      setLoading(false);
      return;
    }

    // hasApi is always false — InteractionChecker uses NIH RxNorm free API only
    setLoading(false);
  }

  // Use API result if available (from AWS Bedrock or RxNorm); local mock only as last resort
  const mockInteractions = checked && !apiResult ? getMockInteractions(selected) : [];
  const hasHigh = apiResult
    ? apiResult.overallRisk === "avoid"
    : mockInteractions.some(r => r.interaction?.severity === "high");

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="hs-card">
        <h2 className="font-bold text-hs-blue-900 mb-1">{t("selectMedicines", "Select Medicines (up to 5)")}</h2>
        <p className="text-sm text-gray-500 mb-3">{selected.length} {t("selected", "selected")}</p>

        {/* Quick-select common drugs */}
        <div className="flex flex-wrap gap-2 mb-3">
          {COMMON_DRUGS.map(d => (
            <button key={d} onClick={() => toggle(d)}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                selected.includes(d)
                  ? "bg-hs-blue-600 text-white border-hs-blue-600"
                  : "bg-white text-gray-700 border-gray-300"
              }`}>
              {d}
            </button>
          ))}
        </div>

        {/* Custom drug input */}
        <div className="flex gap-2 mt-3">
          <input
            className="flex-1 hs-input text-sm"
            placeholder={t("addCustomMedicine", "Add custom medicine name...")}
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustom()}
            disabled={selected.length >= 5}
          />
          <MicButton onResult={text => setCustomInput(text)} disabled={selected.length >= 5} />
          <button onClick={addCustom} disabled={!customInput.trim() || selected.length >= 5}
            className="btn-primary px-3 py-2 text-sm disabled:opacity-40">Add</button>
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selected.map(d => (
              <span key={d} className="flex items-center gap-1 bg-hs-blue-light border border-hs-blue/20 text-hs-blue text-sm px-3 py-1 rounded-full">
                {d}
                <button onClick={() => toggle(d)} className="ml-1 text-hs-blue hover:text-red-500 font-bold">x</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="hs-card bg-amber-50 border border-amber-300">
          <p className="text-xs text-amber-800">{error}</p>
        </div>
      )}

      {selected.length >= 2 && (
        <button className="btn-primary w-full" onClick={handleCheck} disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {hasApi ? "Checking via Bedrock..." : t("checkingRxNorm", "Checking via NIH RxNorm...")}
            </span>
          ) : `${t("checkInteractionsBtn", "Check Interactions")} (${selected.length})`}
        </button>
      )}

      {checked && !loading && (
        <div className="space-y-3 animate-fade-in">
          {/* API-specific: overall risk banner */}
          {apiResult ? (
            <>
              <div className={`hs-card ${
                apiResult.overallRisk === "avoid" ? "bg-red-50 border-2 border-red-400"
                  : apiResult.overallRisk === "caution" ? "bg-yellow-50 border-2 border-yellow-400"
                  : "bg-green-50 border-2 border-green-400"
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`${RISK_BADGE[apiResult.overallRisk]} text-sm font-bold`}>
                    {apiResult.overallRisk.toUpperCase()}
                  </span>
                  {apiResult.fromCache && <span className="text-xs text-gray-400 ml-auto">cached</span>}
                  <ReadAloudButton text={`${apiResult.summary} ${apiResult.interactions.map(i => `${i.pair.join(" and ")}: ${i.effect}. ${i.recommendation}`).join(". ")} ${apiResult.generalAdvice.join(". ")}`} className="ml-auto" />
                </div>
                <TranslatableText text={apiResult.summary} />
              </div>

              {apiResult.interactions.map((inter, i) => (
                <div key={i} className={`hs-card border-l-4 ${SEV_STYLE[inter.severity] || "border-gray-200"}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-sm">{inter.pair.join(" + ")}</p>
                    <span className="text-xs font-medium ml-2">{SEV_LABEL[inter.severity] || inter.severity}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-1">{inter.effect}</p>
                  <p className="text-sm font-medium text-gray-800">{inter.recommendation}</p>
                </div>
              ))}

              {apiResult.generalAdvice.length > 0 && (
                <div className="hs-card bg-blue-50 border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800 mb-2">{t("generalAdvice", "General Advice")}</p>
                  <TranslatableText text={apiResult.generalAdvice.map(a => `- ${a}`).join('\n')} />
                </div>
              )}

              {apiResult.seeDoctor && (
                <div className="hs-card bg-red-50 border border-red-300">
                  <p className="text-sm font-bold text-red-700">{t("consultDoctor", "Please consult your doctor before taking these medicines together.")}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {hasHigh && (
                <div className="hs-card bg-red-50 border-2 border-red-400 text-center">
                  <p className="font-bold text-red-800">{t("highRiskInteraction", "High-risk interaction found! Consult your doctor.")}</p>
                </div>
              )}
              {mockInteractions.map(({ pair, interaction }, i) => (
                <div key={i} className={`hs-card border-l-4 ${interaction ? SEV_STYLE[interaction.severity] : "border-gray-200"}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-sm">{pair[0]} + {pair[1]}</p>
                    {interaction && <span className="text-xs font-medium ml-2">{SEV_LABEL[interaction.severity]}</span>}
                  </div>
                  {interaction ? (
                    <>
                      <p className="text-sm text-gray-700 mb-1">{interaction.effect}</p>
                      <p className="text-sm font-medium text-gray-800">{interaction.action}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">{t("noKnownInteraction", "No known interaction")}</p>
                  )}
                </div>
              ))}

              {/* TTS for mock/RxNorm interactions */}
              <ReadAloudButton text={
                mockInteractions.map(({ pair, interaction }) =>
                  interaction
                    ? `${pair[0]} and ${pair[1]}: ${interaction.effect}. ${interaction.action}`
                    : `${pair[0]} and ${pair[1]}: No known interaction`
                ).join(". ")
              } />
            </>
          )}

          <button className="btn-secondary w-full" onClick={() => { setSelected([]); setChecked(false); setApiResult(null); }}>
            {t("startOver", "Start Over")}
          </button>
        </div>
      )}
    </div>
  );
}
