import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReadAloudButton from "../components/ReadAloudButton";
import { freeTranslate } from "../services/freeTranslate";
import { addToBridgeQueue } from "../services/storage";

type Step = "select" | "followup" | "results";

interface Symptom { id: string; label: string; icon: string; }
interface Condition {
  name: string;
  confidence: number;
  level: "low" | "medium" | "high";
  description: string;
  advice: string[];
  medicines: string[];
  seeDoctor: string;
}

const SYMPTOMS: Symptom[] = [
  { id: "fever", label: "", icon: "🌡️" },
  { id: "cough", label: "", icon: "😷" },
  { id: "headache", label: "", icon: "🤕" },
  { id: "stomach", label: "", icon: "🤢" },
  { id: "diarrhoea", label: "", icon: "💧" },
  { id: "vomiting", label: "", icon: "🤮" },
  { id: "breathless", label: "", icon: "😮‍💨" },
  { id: "rash", label: "", icon: "🔴" },
  { id: "joint", label: "", icon: "🦴" },
  { id: "fatigue", label: "", icon: "😴" },
];

// ── Condition database: each condition lists which symptoms it matches ───────
type ConditionEntry = Condition & { keySymptoms: string[]; };

const CONDITION_DB: ConditionEntry[] = [
  {
    keySymptoms: ["fever", "cough", "headache", "fatigue"],
    name: "Viral Fever / Upper Respiratory Infection",
    confidence: 78, level: "medium",
    description: "Your symptoms suggest a common viral infection affecting the nose and throat. Typically lasts 5–7 days and improves on its own with rest.",
    advice: ["Rest and stay home for 2–3 days", "Drink plenty of fluids — ORS, coconut water, dal ka pani, warm soup", "Take Paracetamol 500mg for fever if temperature > 100.4°F (38°C)", "Eat light food — khichdi, rice porridge, banana", "Gargle with warm salt water for sore throat"],
    medicines: ["Paracetamol 500mg — every 6 hours for fever/body ache", "Vitamin C 500mg daily — boosts immunity", "ORS sachet — prevents dehydration"],
    seeDoctor: "Fever above 104°F, difficulty breathing, no improvement after 3 days, or yellow/green nasal discharge",
  },
  {
    keySymptoms: ["fever", "rash", "headache", "joint", "fatigue"],
    name: "Dengue Fever",
    confidence: 70, level: "high",
    description: "Combination of fever, rash, and joint/bone pain is a classic dengue pattern (called 'breakbone fever'). Most common during and after monsoon season.",
    advice: ["Go to nearest PHC or hospital for blood test (NS1 + CBC) immediately", "Rest completely — do NOT exert yourself", "Drink 3–4 litres of fluids daily — ORS, coconut water, juices", "Check platelet count every 24 hours if confirmed dengue"],
    medicines: ["Paracetamol ONLY for fever — never Aspirin, Ibuprofen, or Combiflam (causes bleeding)", "ORS every hour to stay hydrated"],
    seeDoctor: "Go TODAY — bleeding from gums/nose, red spots on skin, severe abdominal pain, vomiting blood, or platelet < 1 lakh",
  },
  {
    keySymptoms: ["fever", "fatigue", "headache", "joint"],
    name: "Possible Malaria",
    confidence: 65, level: "high",
    description: "Cyclical fever with chills, fatigue, and body ache — especially in areas with standing water — is a classic malaria pattern. Requires blood test to confirm.",
    advice: ["Go to nearest PHC immediately for RDT (Rapid Diagnostic Test) — it is FREE at government centres", "Do NOT self-medicate with antimalarials without confirmation", "Use mosquito net while sleeping"],
    medicines: ["Anti-malarial medicines prescribed ONLY after positive RDT test", "Paracetamol for fever until test result is available"],
    seeDoctor: "Go TODAY — do not wait. Untreated malaria can become severe within 24–48 hours",
  },
  {
    keySymptoms: ["diarrhoea", "vomiting", "stomach", "fever", "fatigue"],
    name: "Gastroenteritis (Stomach Infection)",
    confidence: 85, level: "medium",
    description: "Loose stools, vomiting, and stomach pain together indicate a stomach infection, likely from contaminated water or food. Very common during summer and monsoon.",
    advice: ["Start ORS immediately — 1 glass after every loose motion", "Make home ORS: 1 litre clean water + 6 tsp sugar + 1 tsp salt", "Eat light: banana, curd rice, plain khichdi, plain toast", "Avoid dairy, oily or spicy food, raw vegetables", "Wash hands with soap before eating and after toilet"],
    medicines: ["ORS sachets or homemade ORS — most important treatment", "Zinc 20mg daily for 10 days (for children) reduces duration", "Probiotics (curd) help restore gut bacteria"],
    seeDoctor: "Blood in stool, fever above 102°F, signs of dehydration (no urine for 6+ hrs, dry mouth, sunken eyes), or vomiting after every sip of water",
  },
  {
    keySymptoms: ["breathless", "cough", "chest", "fever"],
    name: "Possible Chest Infection / Pneumonia",
    confidence: 75, level: "high",
    description: "Cough with breathlessness, especially with fever, can indicate a lower respiratory infection like bronchitis or pneumonia. This needs medical attention quickly.",
    advice: ["See a doctor or go to PHC TODAY", "Do NOT lie flat — sit upright or prop yourself with pillows", "Drink warm fluids — warm water, tulsi-ginger tea", "Do NOT ignore breathlessness — it can worsen quickly in elderly and children"],
    medicines: ["Antibiotics and treatment only as prescribed by doctor — do NOT self-medicate", "Salbutamol inhaler if wheezing — only with doctor advice"],
    seeDoctor: "URGENT: Go to hospital immediately if breathing is very fast, lips/nails turn blue, severe chest pain, or confused/drowsy",
  },
  {
    keySymptoms: ["breathless", "cough", "fatigue"],
    name: "Asthma / Allergic Bronchospasm",
    confidence: 68, level: "medium",
    description: "Recurrent episodes of wheezing, cough, and breathlessness — especially worse at night or with dust/smoke exposure — suggest asthma or allergic airway disease.",
    advice: ["Avoid triggers: dust, smoke, strong smells, cold air", "Cover nose/mouth with cloth in dusty areas", "Keep inhaler with you at all times if prescribed", "Avoid burning cow-dung or wood indoors without ventilation"],
    medicines: ["Salbutamol inhaler (reliever) — for acute attacks, as prescribed", "Do NOT stop preventive inhalers without doctor advice"],
    seeDoctor: "Breathing does not improve with inhaler, can't speak full sentences, breathing rate very fast, or first episode — consult doctor for diagnosis",
  },
  {
    keySymptoms: ["rash", "fever", "fatigue"],
    name: "Skin Rash with Fever",
    confidence: 70, level: "medium",
    description: "A rash with fever can indicate several conditions including measles, chickenpox, or allergic reaction. Type, pattern, and location of the rash matters.",
    advice: ["Do NOT scratch the rash — it can cause infection", "Keep the affected area clean and dry", "Note whether rash spreads, has blisters, or is only on one side of body", "Keep the child away from school or others if infectious disease suspected"],
    medicines: ["Calamine lotion for itching", "Do NOT apply any home remedies without doctor advice", "Antihistamine (Cetirizine) ONLY if rash is clearly allergic"],
    seeDoctor: "Same day — show the rash to a doctor for proper diagnosis. Measles and chickenpox need isolation to prevent spread.",
  },
  {
    keySymptoms: ["joint", "rash", "fever", "fatigue"],
    name: "Chikungunya / Viral Arthritis",
    confidence: 72, level: "medium",
    description: "Severe joint pain with fever and sometimes rash — worse in the mornings — is typical of chikungunya. Very common in Maharashtra and south India during and after monsoon.",
    advice: ["Rest completely — joint pain can last weeks to months", "Apply warm compress on painful joints", "Do gentle exercises when pain reduces to prevent stiffness", "Get blood test (IgM antibody test) to confirm if fever persists > 5 days"],
    medicines: ["Paracetamol for pain and fever", "Do NOT take Aspirin or Ibuprofen initially", "Chloroquine may be prescribed in some cases by doctor"],
    seeDoctor: "Joint pain lasting more than 2 weeks, very high fever, or if elderly patient — risk of complications is higher",
  },
  {
    keySymptoms: ["headache", "fatigue", "vomiting"],
    name: "Tension Headache / Migraine",
    confidence: 74, level: "low",
    description: "Headache with nausea/vomiting and fatigue — without fever — is usually a tension headache or migraine. Triggered by stress, dehydration, lack of sleep, or skipped meals.",
    advice: ["Lie down in a quiet, dark room and rest", "Drink 2–3 glasses of water immediately — dehydration is a common trigger", "Apply cold cloth or ice pack to forehead", "Avoid screens, loud noise, strong light", "Eat something — low blood sugar can trigger migraine"],
    medicines: ["Paracetamol 500–1000mg with water at first sign of headache", "Avoid self-medicating with stronger pain medicines frequently"],
    seeDoctor: "Worst headache of your life (thunderclap), headache with stiff neck and fever (meningitis), headache with vision changes or weakness in limbs — go to hospital immediately",
  },
  {
    keySymptoms: ["stomach", "vomiting"],
    name: "Acidity / Gastritis",
    confidence: 76, level: "low",
    description: "Burning sensation in stomach or chest (acid reflux), nausea, and stomach discomfort after eating typically indicate gastritis or acidity — very common with irregular meals or spicy food.",
    advice: ["Eat small, frequent meals — do not skip meals", "Avoid: spicy food, tea/coffee on empty stomach, soda, alcohol", "Do not lie down immediately after eating", "Drink a glass of cold milk or buttermilk for quick relief"],
    medicines: ["Antacid (Gelusil, Digene) — for quick relief", "Omeprazole 20mg before breakfast — if symptoms are recurrent (consult doctor)"],
    seeDoctor: "Black stools, vomiting blood, severe abdominal pain, or symptoms persisting > 2 weeks despite antacids",
  },
  {
    keySymptoms: ["fatigue", "headache", "breathless"],
    name: "Anaemia / Low Haemoglobin",
    confidence: 68, level: "medium",
    description: "Persistent tiredness, headache, breathlessness on exertion, and pallor (pale skin, white nails) together strongly suggest iron deficiency anaemia — very common in women, adolescents, and pregnant women in India.",
    advice: ["Eat iron-rich foods: green leafy vegetables (spinach, methi), rajma, chana, jaggery, dates, eggs, meat", "Take iron tablets WITH vitamin C (lemon water/amla) to improve absorption", "Avoid tea/coffee within 1 hour of iron tablet", "Get CBC blood test to check haemoglobin level"],
    medicines: ["Iron + Folic Acid tablets — as prescribed by doctor", "Vitamin B12 if deficiency confirmed"],
    seeDoctor: "Haemoglobin below 8 g/dL, breathlessness at rest, palpitations, or swelling in feet — requires immediate medical attention",
  },
  {
    keySymptoms: ["joint", "fatigue", "headache"],
    name: "Viral Body Ache / Post-viral Syndrome",
    confidence: 65, level: "low",
    description: "Generalised body ache, joint pain, and fatigue without high fever often follows a recent viral illness (flu, COVID-19, dengue recovery). Usually resolves on its own in 1–4 weeks.",
    advice: ["Rest fully — do not push through fatigue, give your body time to recover", "Light stretching or walking when feeling better", "Eat nutritious food — protein, fruits, vegetables", "Stay well hydrated"],
    medicines: ["Paracetamol for pain", "Multivitamin with zinc and vitamin C supports recovery"],
    seeDoctor: "Symptoms persisting beyond 4 weeks, worsening fatigue, shortness of breath, or new symptoms developing",
  },
];

// Pick top 2 conditions most relevant to the selected symptom set
function getMatchedConditions(selected: Set<string>): Condition[] {
  const arr = Array.from(selected);
  const scored = CONDITION_DB.map(c => ({
    ...c,
    score: c.keySymptoms.filter(s => arr.includes(s)).length,
  }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, 2);
  // Always return at least 1 result
  if (scored.length === 0) return [CONDITION_DB[0]];
  return scored;
}

const FOLLOWUP = [
  { id: "duration", labelKey: "fq_duration", optionKeys: ["fq_duration_1", "fq_duration_2", "fq_duration_3", "fq_duration_4"] },
  { id: "severity", labelKey: "fq_severity", optionKeys: ["fq_severity_1", "fq_severity_2", "fq_severity_3"] },
  { id: "age_group", labelKey: "fq_age_group", optionKeys: ["fq_age_group_1", "fq_age_group_2", "fq_age_group_3"] },
];

function ConfBar({ pct, level }: { pct: number; level: "low" | "medium" | "high" }) {
  const color = level === "high" ? "bg-hs-red" : level === "medium" ? "bg-hs-yellow" : "bg-hs-green";
  return (
    <div className="h-2 bg-hs-bg rounded-full overflow-hidden mt-1">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SymptomChecker() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "hi" | "mr";

  // Matched conditions based on selected symptoms (translated)
  const [matchedConditions, setMatchedConditions] = useState<Condition[]>([]);

  // Translate a set of conditions to the current language
  const translateConditions = async (conditions: Condition[]): Promise<Condition[]> => {
    if (lang === "en") return conditions;
    return Promise.all(conditions.map(async c => {
      const [name, description, ...rest] = await Promise.all([
        freeTranslate(c.name, lang, "en").catch(() => c.name),
        freeTranslate(c.description, lang, "en").catch(() => c.description),
        ...c.advice.map(a => freeTranslate(a, lang, "en").catch(() => a)),
      ]);
      const adviceTranslated = rest.slice(0, c.advice.length);
      const [seeDoctor, ...medsTranslated] = await Promise.all([
        freeTranslate(c.seeDoctor, lang, "en").catch(() => c.seeDoctor),
        ...c.medicines.map(m => freeTranslate(m, lang, "en").catch(() => m)),
      ]);
      return { ...c, name, description, advice: adviceTranslated, medicines: medsTranslated, seeDoctor };
    }));
  };

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const handleCheck = async () => {
    setStep("results");
    setLoading(true);
    // Compute conditions matched to selected symptoms, then translate
    const matched = getMatchedConditions(selected);
    const translated = await translateConditions(matched).catch(() => matched);
    setMatchedConditions(translated);
    setLoading(false);
    // Bridge: queue anonymous symptom check data for doctor dashboard
    const symptomKeywords = Array.from(selected);
    addToBridgeQueue("symptom_check", symptomKeywords, {
      conditionCount: matched.length,
      severity: matched.some(c => c.confidence >= 80) ? "high" : matched.some(c => c.confidence >= 50) ? "moderate" : "low",
    });
  };
  const redo = () => {
    setStep("select");
    setSelected(new Set());
    setAnswers({});
    setMatchedConditions([]);
  };

  return (
    <div className="min-h-full bg-hs-bg">
      <div className="sticky top-0 z-10 bg-white border-b border-hs-border px-4 h-14 flex items-center justify-between">
        <button onClick={() => step === "select" ? navigate(-1) : setStep(step === "followup" ? "select" : "followup")} className="btn-icon border-0">
          <svg className="w-5 h-5 text-hs-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-hs-text">{t("scTitle", "Symptom Checker")}</h1>
        <span className="text-xs text-hs-text-secondary">{step === "select" ? "1/3" : step === "followup" ? "2/3" : "3/3"}</span>
      </div>

      {step === "select" && (
        <div className="px-4 py-5 max-w-2xl mx-auto animate-fade-in">
          <h2 className="text-lg font-bold text-hs-text mb-1">{t("scSymptomsQ")}</h2>
          <p className="text-sm text-hs-text-secondary mb-4">{t("scSymptomsHint")}</p>
          {!navigator.onLine && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-3 mb-2 text-sm text-yellow-800">
              📡 <strong>{t("noInternet")}</strong> — {t("scOfflineBanner", "Will show example assessment. Connect for AI-powered results.")}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {SYMPTOMS.map(s => (
              <button key={s.id} onClick={() => toggle(s.id)}
                className={`flex items-center gap-3 px-4 py-3 min-h-[56px] rounded-2xl border-2 font-semibold text-sm transition-colors
                  ${selected.has(s.id) ? "bg-hs-blue-light border-hs-blue text-hs-blue" : "bg-white border-hs-border text-hs-text"}`}>
                <span className="text-2xl">{s.icon}</span>{t(`sym_${s.id}`, s.id)}
              </button>
            ))}
          </div>
          <button disabled={selected.size === 0} onClick={() => setStep("followup")}
            className="btn-primary w-full py-4 disabled:opacity-40">
            {t("scNextBtn")}
          </button>
          {selected.size > 0 && (
            <p className="text-xs text-center text-hs-text-secondary mt-2">
              {selected.size} {selected.size > 1 ? t("scSelectedPlural", "symptoms selected") : t("scSelected", "symptom selected")}
            </p>
          )}
        </div>
      )}

      {step === "followup" && (
        <div className="px-4 py-5 max-w-md mx-auto animate-fade-in space-y-6">
          <h2 className="text-lg font-bold text-hs-text">{t("scMoreTitle")}</h2>
          {FOLLOWUP.map(q => (
            <div key={q.id}>
              <p className="text-sm font-semibold text-hs-text mb-2">{t(q.labelKey)}</p>
              <div className="space-y-2">
                {q.optionKeys.map(optKey => (
                  <button key={optKey} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: optKey }))}
                    className={`w-full text-left px-4 py-3 min-h-[44px] rounded-xl border-2 text-sm font-medium transition-colors
                      ${answers[q.id] === optKey ? "bg-hs-blue-light border-hs-blue text-hs-blue" : "bg-white border-hs-border text-hs-text"}`}>
                    {t(optKey)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button disabled={Object.keys(answers).length < FOLLOWUP.length} onClick={handleCheck}
            className="btn-primary w-full py-4 disabled:opacity-40">
            {t("scCheckBtn")}
          </button>
        </div>
      )}

      {step === "results" && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <svg className="w-10 h-10 animate-spin text-hs-blue" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-hs-text-secondary">Analysing your symptoms...</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-hs-text">{t("scPossibleConditions")}</h2>
                <p className="text-xs text-hs-text-secondary mt-0.5">{t("scBasedOn")} {Array.from(selected).map(s => t(`sym_${s}`, s)).join(", ")} {answers.duration ? ("\u00b7 " + t(answers.duration)) : ""}</p>
              </div>
              <div className="bg-hs-yellow-light border border-hs-yellow/20 rounded-2xl p-3 text-xs text-hs-text-secondary">
                {t("aiNotDiagnosis")}
              </div>
              {matchedConditions.map(c => (
                <div key={c.name} className={`hs-card border-l-4 ${c.level === "high" ? "border-hs-red" : c.level === "medium" ? "border-hs-yellow" : "border-hs-green"}`}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-base font-bold text-hs-text leading-snug flex-1 mr-2">{c.name}</p>
                    <ReadAloudButton text={`${c.name}. ${c.description}. What to do: ${c.advice.join(". ")}. Medicines: ${c.medicines.join(". ")}. See doctor if: ${c.seeDoctor}`} className="flex-shrink-0 mr-1" />
                    <span className={`badge-${c.level === "high" ? "danger" : c.level === "medium" ? "warning" : "success"} text-xs flex-shrink-0`}>{c.confidence}%</span>
                  </div>
                  <ConfBar pct={c.confidence} level={c.level} />
                  <p className="text-sm text-hs-text-secondary mt-3">{c.description}</p>
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-bold text-hs-text uppercase">{t("scWhatToDo")}</p>
                    <ul className="space-y-1">
                      {c.advice.map(a => (
                        <li key={a} className="flex items-start gap-2 text-sm text-hs-text">
                          <span className="text-hs-green mt-0.5">✓</span>{a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {c.medicines.length > 0 && (
                    <div className="mt-3 bg-hs-blue-light rounded-xl p-3">
                      <p className="text-xs font-bold text-hs-blue mb-2">{t("scPossibleMeds")}</p>
                      {c.medicines.map(m => <p key={m} className="text-sm text-hs-text">{m}</p>)}
                    </div>
                  )}
                  <div className="mt-3 bg-hs-red-light border border-hs-red/20 rounded-xl p-3">
                    <p className="text-xs font-bold text-hs-red mb-1">{t("scSeeDoctor")}</p>
                    <p className="text-sm text-hs-text">{c.seeDoctor}</p>
                  </div>
                </div>
              ))}
              <div className="space-y-2 pb-4">
                <button onClick={redo} className="btn-secondary w-full">{t("checkAgain")}</button>
              </div>
              <p className="text-xs text-hs-text-secondary text-center pb-2">{t("aiGuidanceOnly")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
