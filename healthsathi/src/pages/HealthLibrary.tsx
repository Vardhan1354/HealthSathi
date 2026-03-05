import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import MicButton from "../components/MicButton";
import ReadAloudButton from "../components/ReadAloudButton";
import { freeTranslate } from "../services/freeTranslate";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface Article {
  id: number;
  title: string;
  category: string;
  readTime: string;
  tags: string[];
  summary: string;
  content: string[];
}

const ARTICLES: Article[] = [
  {
    id: 1, title: "How to Prevent Diarrhoea", category: "hygiene", readTime: "3 min",
    tags: ["water", "sanitation", "children"],
    summary: "Simple steps to keep your family safe from diarrhoea.",
    content: [
      "CAUSE: Diarrhoea is caused by bacteria or viruses from dirty water or food.",
      "Wash hands with soap before eating and after using the toilet.",
      "Drink only boiled or filtered water.",
      "TREATMENT: Give ORS (oral rehydration solution) immediately.",
      "Mix 1 liter of clean water + 6 tsp sugar + 1 tsp salt to make ORS at home.",
      "WHEN TO SEE DOCTOR: Blood in stool, fever above 38C, or no improvement in 2 days.",
    ],
  },
  {
    id: 2, title: "Malaria - Symptoms & Prevention", category: "disease", readTime: "4 min",
    tags: ["malaria", "mosquito", "fever"],
    summary: "Know the signs of malaria and how to protect your family.",
    content: [
      "SYMPTOMS: High fever with chills, headache, body ache, sweating.",
      "Malaria is spread by Anopheles mosquito bites - mostly at night.",
      "PREVENTION: Sleep under mosquito nets. Use repellent. Drain stagnant water near home.",
      "TREATMENT: Visit health centre immediately if fever with chills.",
      "Do not stop medicines even if you feel better - complete the full course.",
    ],
  },
  {
    id: 3, title: "Antenatal Care Guide", category: "maternal", readTime: "5 min",
    tags: ["pregnancy", "antenatal", "mother"],
    summary: "Importance of check-ups during pregnancy.",
    content: [
      "Visit the health centre at least 4 times during pregnancy.",
      "FIRST VISIT: Within first 3 months - confirm pregnancy, blood tests, tetanus injection.",
      "NUTRITION: Eat iron-rich foods - green leafy vegetables, lentils, eggs.",
      "Take iron and folic acid tablets every day as prescribed.",
      "DANGER SIGNS: Heavy bleeding, severe headache, blurred vision - go to hospital immediately.",
      "Deliver at a health facility - do not deliver at home.",
    ],
  },
  {
    id: 4, title: "Managing High Blood Pressure", category: "chronic", readTime: "4 min",
    tags: ["hypertension", "bp", "heart"],
    summary: "Control blood pressure with simple lifestyle changes.",
    content: [
      "Normal BP is below 120/80 mmHg. High BP is 140/90 or above.",
      "RISK FACTORS: Salt-heavy diet, stress, smoking, lack of exercise, obesity.",
      "DIET: Reduce salt. Eat more fruits and vegetables. Avoid fried foods.",
      "Exercise 30 minutes daily - walking is enough.",
      "MEDICINES: Take BP medicines every day. Never stop without doctor advice.",
      "Check BP every month at the health centre.",
    ],
  },
  {
    id: 5, title: "Child Vaccination Schedule", category: "child", readTime: "3 min",
    tags: ["vaccine", "children", "immunization"],
    summary: "Keep your child protected with timely vaccinations.",
    content: [
      "AT BIRTH: BCG, OPV-0, Hepatitis B-1.",
      "AT 6 WEEKS: OPV-1, Pentavalent-1, Rotavirus-1, PCV-1.",
      "AT 10 WEEKS: OPV-2, Pentavalent-2, Rotavirus-2, PCV-2.",
      "AT 14 WEEKS: OPV-3, Pentavalent-3, Rotavirus-3, PCV-3.",
      "AT 9 MONTHS: Measles/MR-1.",
      "IMPORTANT: Carry your child's immunization card to every visit.",
      "Vaccines are free at all government health centres.",
    ],
  },
];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "hygiene", label: "Hygiene" },
  { id: "disease", label: "Disease" },
  { id: "maternal", label: "Maternal" },
  { id: "chronic", label: "Chronic" },
  { id: "child", label: "Child" },
];

const SUGGESTED_QUESTIONS = [
  "How do I make ORS at home?",
  "What are signs of malaria?",
  "When should I take my child for vaccination?",
  "How to control high blood pressure?",
  "What foods to eat during pregnancy?",
  "How is dengue different from malaria?",
];

const SESSION_KEY = "hs_chat_session_id";
const HISTORY_KEY = "hs_chat_history";

function restoreSessionId(): string {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) return saved;
  const id = `hs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function restoreHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch { /* ignore */ }
  return [
    {
      role: "assistant",
      text: "Hello! I am HealthSathi - your community health assistant. Ask me any health question in English, Hindi, or Marathi.",
      timestamp: Date.now(),
    },
  ];
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function AiBubble({ text }: { text: string }) {
  const parts = text.split("\n");
  return (
    <div className="space-y-0.5">
      {parts.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-bold text-hs-text">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <p key={i} className="pl-3 text-hs-text">• {line.slice(2)}</p>;
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} className="text-hs-text leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ─── Local health knowledge base ────────────────────────────────────────────
const HEALTH_KB: Record<string, string> = {
  "cold|common cold|runny nose|sneezing": "**Common Cold**\n\nA viral infection of the nose and throat. Symptoms include runny nose, sneezing, sore throat, mild fever, and body ache.\n\n**Home Remedies:**\n- Drink warm fluids — ginger tea, turmeric milk, warm water with honey and lemon\n- Steam inhalation 2–3 times a day\n- Rest and sleep well\n- Gargle with warm salt water for sore throat\n\n**Medicines:**\n- Paracetamol 500mg for fever and body ache\n- Cetirizine for runny nose/sneezing\n- Vitamin C 500mg daily\n\n**See Doctor If:** Fever above 102°F for more than 3 days, difficulty breathing, or green/yellow mucus.",
  "fever|high temperature|bukhar": "**Fever**\n\nFever is your body's way of fighting infection. Normal body temperature is 98.6°F (37°C). Fever is when temperature goes above 100.4°F (38°C).\n\n**Immediate Steps:**\n- Take Paracetamol 500mg (every 6 hours, max 4 times/day)\n- Drink lots of water, ORS, coconut water\n- Sponge with room-temperature water (NOT cold water)\n- Wear light clothing\n- Rest completely\n\n**Common Causes:** Viral infection, malaria, dengue, typhoid, UTI\n\n**See Doctor If:** Fever above 103°F, rash with fever, severe headache with stiff neck, or fever lasting more than 3 days.",
  "cough|khansi|dry cough|wet cough": "**Cough**\n\nCough is your body's reflex to clear airways. Can be dry (no mucus) or wet/productive (with mucus).\n\n**For Dry Cough:**\n- Honey with warm water (1 tablespoon honey in warm water)\n- Tulsi (basil) tea with ginger\n- Avoid cold drinks and ice cream\n\n**For Wet Cough:**\n- Steam inhalation to loosen mucus\n- Drink warm fluids frequently\n- Sleep with head slightly raised\n\n**Medicines:**\n- Honey-based cough syrup for dry cough\n- Do NOT suppress productive cough unless it disrupts sleep\n\n**See Doctor If:** Cough lasting more than 2 weeks, blood in mucus, breathlessness, or wheezing.",
  "headache|sir dard|migraine": "**Headache**\n\nMost headaches are tension headaches caused by stress, dehydration, or lack of sleep.\n\n**Quick Relief:**\n- Drink 2–3 glasses of water immediately\n- Rest in a quiet, dark room\n- Apply cold/warm compress to forehead\n- Massage temples gently\n\n**Prevention:**\n- Sleep 7–8 hours daily\n- Don't skip meals\n- Reduce screen time\n- Manage stress with deep breathing\n\n**Medicines:** Paracetamol 500mg for relief\n\n**See Doctor If:** Worst headache ever, headache with fever + stiff neck, vision changes, or weakness on one side.",
  "diarrhoea|diarrhea|loose motion|pet kharab": "**Diarrhoea / Loose Motions**\n\nUsually caused by contaminated water or food. Very common in monsoon season.\n\n**MOST IMPORTANT — Start ORS Immediately:**\n- Home ORS: 1 litre clean water + 6 teaspoons sugar + 1 teaspoon salt\n- Give 1 glass after every loose motion\n- Continue breastfeeding if baby has diarrhoea\n\n**Diet:**\n- Eat light: banana, curd rice, khichdi, toast\n- Avoid milk, spicy food, oily food, raw vegetables\n\n**Prevention:**\n- Wash hands with soap before eating\n- Drink only boiled/filtered water\n- Keep food covered\n\n**See Doctor If:** Blood in stool, high fever, no urine for 6+ hours, sunken eyes, or excessive vomiting.",
  "diabetes|sugar|blood sugar|madhumeh": "**Diabetes**\n\nA condition where blood sugar levels are too high. Type 2 diabetes is most common in India.\n\n**Normal Values:**\n- Fasting blood sugar: 70–100 mg/dL\n- After food (2 hours): Below 140 mg/dL\n- HbA1c: Below 5.7%\n\n**Management:**\n- Eat regular, balanced meals at fixed times\n- Reduce rice, white bread, sweets, sugary drinks\n- Include more vegetables, dal, whole grains\n- Walk 30 minutes daily\n- Take medicines as prescribed — NEVER skip\n\n**Check regularly:** Blood sugar monthly at PHC\n\n**See Doctor If:** Very high thirst, frequent urination, blurred vision, wounds not healing, or numbness in feet.",
  "bp|blood pressure|hypertension|high bp": "**High Blood Pressure (Hypertension)**\n\nOften called the 'silent killer' because it usually has no symptoms but damages heart, brain, and kidneys.\n\n**Normal BP:** Below 120/80 mmHg\n**High BP:** 140/90 mmHg or above\n\n**Management:**\n- Reduce salt — less than 1 teaspoon/day\n- Eat more fruits, vegetables, whole grains\n- Walk or exercise 30 minutes daily\n- Reduce stress — practice deep breathing\n- Avoid smoking and alcohol\n- Take BP medicines daily — NEVER stop without doctor advice\n\n**Check BP** every month at the health centre.\n\n**Emergency Signs:** Severe headache, chest pain, blurred vision, difficulty speaking — go to hospital IMMEDIATELY.",
  "malaria|mosquito|chills": "**Malaria**\n\nSpread by Anopheles mosquito bites, mostly at night. Very common in monsoon season.\n\n**Symptoms:**\n- High fever with chills and shivering (cyclical — comes and goes)\n- Severe headache and body ache\n- Sweating after fever episode\n- Nausea, vomiting\n\n**What To Do:**\n- Get RDT (Rapid Diagnostic Test) at nearest PHC — it's FREE\n- Do NOT self-medicate with antimalarials\n- Take Paracetamol for fever while waiting for test result\n\n**Prevention:**\n- Sleep under mosquito net every night\n- Use mosquito repellent\n- Drain standing water near home\n- Wear full-sleeve clothes in evening\n\n**URGENT:** Go to hospital if very high fever, confusion, yellow eyes, or dark urine.",
  "dengue|platelet|breakbone": "**Dengue Fever**\n\nSpread by Aedes mosquito (bites during daytime). Common during and after monsoon.\n\n**Symptoms:**\n- High fever (104°F) lasting 2–7 days\n- Severe headache, pain behind eyes\n- Severe joint and muscle pain ('breakbone fever')\n- Skin rash, red spots\n- Nausea, vomiting\n\n**CRITICAL:**\n- Take ONLY Paracetamol — NEVER Aspirin, Ibuprofen, or Combiflam (causes bleeding)\n- Drink 3–4 litres of fluids daily — ORS, coconut water, juices\n- Check platelet count every 24 hours\n- Rest completely\n\n**Emergency Signs:** Bleeding from gums/nose, red spots on skin, severe stomach pain, persistent vomiting, rapid breathing — GO TO HOSPITAL IMMEDIATELY.",
  "pregnancy|pregnant|garbhavati|antenatal": "**Pregnancy Care**\n\nRegular check-ups are essential for a healthy mother and baby.\n\n**Important Visits:**\n- First visit: Within first 3 months\n- Minimum 4 visits during pregnancy\n- All visits are FREE at government health centres\n\n**Nutrition:**\n- Eat iron-rich foods: green leafy vegetables, lentils, eggs, jaggery\n- Take Iron + Folic Acid tablets daily (available free at PHC)\n- Eat small frequent meals\n- Drink plenty of water\n\n**Danger Signs — Go to Hospital Immediately:**\n- Heavy bleeding\n- Severe headache with blurred vision\n- High fever\n- Swelling of face/hands\n- Baby not moving (after 5 months)\n\n**Always deliver at a health facility** — not at home.",
  "vaccination|vaccine|tika|immunization": "**Child Vaccination Schedule (India)**\n\n**At Birth:** BCG, OPV-0, Hepatitis B (first dose)\n**6 Weeks:** OPV-1, Pentavalent-1, Rotavirus-1, PCV-1\n**10 Weeks:** OPV-2, Pentavalent-2, Rotavirus-2\n**14 Weeks:** OPV-3, Pentavalent-3, Rotavirus-3, PCV-2\n**9 Months:** Measles/MR-1, PCV booster\n**16-24 Months:** DPT booster, OPV booster, Measles/MR-2\n\n**Important:**\n- All vaccines are FREE at government health centres\n- Always carry immunization card\n- Mild fever after vaccination is NORMAL\n- Do NOT miss scheduled dates\n\nVaccines protect children from deadly diseases like polio, measles, and whooping cough.",
  "ors|dehydration|oral rehydration": "**ORS — Oral Rehydration Solution**\n\nORS is the most important treatment for dehydration from diarrhoea, vomiting, or fever.\n\n**How to Make ORS at Home:**\n1. Take 1 litre of clean (boiled/filtered) water\n2. Add 6 level teaspoons of sugar\n3. Add 1 level teaspoon of salt\n4. Mix well until dissolved\n5. Taste — should be less salty than tears\n\n**How to Give:**\n- Small sips frequently (not large amounts at once)\n- 1 glass after every loose motion\n- Continue for 24 hours even if diarrhoea stops\n- Make fresh ORS every 24 hours\n\n**For Babies:** Give with spoon or dropper, not bottle.\n\nORS packets are also available FREE at all government health centres.",
  "typhoid|motijhara": "**Typhoid Fever**\n\nCaused by contaminated water or food. Bacteria: Salmonella typhi.\n\n**Symptoms:**\n- Fever that rises gradually (step-ladder pattern)\n- Headache, body ache, weakness\n- Stomach pain, loss of appetite\n- Sometimes loose motions or constipation\n\n**What To Do:**\n- Get Widal test or blood culture at health centre\n- Take antibiotics as prescribed by doctor — complete the FULL course\n- Drink boiled water only\n- Eat light, cooked food\n- Rest completely\n\n**Prevention:**\n- Drink only boiled/filtered water\n- Eat freshly cooked food\n- Wash hands before eating\n- Typhoid vaccine available\n\n**See Doctor If:** Fever lasting more than 5 days, severe stomach pain, blood in stool.",
  "skin|rash|khujli|itching|eczema": "**Common Skin Problems**\n\n**Fungal Infection (Ring-shaped rash):**\n- Keep area clean and dry\n- Apply antifungal cream (Clotrimazole) twice daily\n- Wear loose cotton clothes\n- Don't share towels\n\n**Scabies (Intense itching, worse at night):**\n- Apply Permethrin cream as directed\n- Wash all clothes and bedding in hot water\n- Treat ALL family members together\n\n**Eczema (Dry, itchy, scaly patches):**\n- Moisturize frequently\n- Avoid harsh soaps\n- Apply prescribed steroid cream only on affected area\n\n**See Doctor If:** Rash with fever, spreading rapidly, pus-filled, or not improving in 1 week.",
};

function searchLocalKB(query: string): string | null {
  const q = query.toLowerCase();
  for (const [keys, answer] of Object.entries(HEALTH_KB)) {
    const keyList = keys.split("|");
    if (keyList.some(k => q.includes(k.toLowerCase()))) {
      return answer;
    }
  }
  return null;
}

// ─── MedlinePlus NIH search (English only) ──────────────────────────────────
async function searchMedlinePlus(query: string): Promise<string | null> {
  try {
    const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(query)}&retmax=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const text = await res.text();
    // Parse XML for <content> snippet
    const titleMatch = text.match(/<content name="title">([^<]+)<\/content>/);
    const snippetMatch = text.match(/<content name="FullSummary">([\s\S]*?)<\/content>/);
    if (titleMatch && snippetMatch) {
      const title = titleMatch[1].trim();
      const summary = snippetMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 800);
      if (summary.length > 50) return `**${title}**\n\n${summary}\n\n_Source: MedlinePlus (NIH) — consult a doctor for medical advice._`;
    }
  } catch { /* network error — skip */ }
  return null;
}

// ─── Free fallback: Wikipedia API for health info ───────────────────────────
// Tries local KB first, then MedlinePlus, then Wikipedia (language-aware).
const WIKI_LANG: Record<string, string> = { en: "en", hi: "hi", mr: "mr" };

async function searchWikipedia(query: string, lang = "en"): Promise<string> {
  const healthQuery = query.replace(/\?/g, "").trim();
  const wikiLang = WIKI_LANG[lang] ?? "en";
  const base = `https://${wikiLang}.wikipedia.org`;
  const enBase = "https://en.wikipedia.org";
  const srcNote = lang !== "en" ? `Source: Wikipedia (${wikiLang}) — consult a doctor for medical advice.` : "Source: Wikipedia — For full information, consult a doctor.";

  // 1) Check local health knowledge base first (instant, works offline)
  const kbResult = searchLocalKB(healthQuery);
  if (kbResult) return kbResult + "\n\n_Source: HealthSathi Knowledge Base — Always consult a licensed doctor for medical advice._";

  // 2) Try MedlinePlus NIH (English only, authoritative)
  if (lang === "en") {
    const mlResult = await searchMedlinePlus(healthQuery);
    if (mlResult) return mlResult;
  }

  async function tryWiki(baseUrl: string, q: string): Promise<string | null> {
    try {
      // 1) direct page summary
      const r1 = await fetch(`${baseUrl}/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(6000) });
      if (r1.ok) {
        const d = await r1.json();
        if (d.extract && d.extract.length > 80) return `**${d.title}**\n\n${d.extract}`;
      }
      // 2) opensearch fallback
      const r2 = await fetch(`${baseUrl}/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=2&format=json&origin=*`, { signal: AbortSignal.timeout(5000) });
      if (r2.ok) {
        const [, titles] = await r2.json() as [string, string[]];
        if (titles.length > 0) {
          const r3 = await fetch(`${baseUrl}/api/rest_v1/page/summary/${encodeURIComponent(titles[0])}`, { signal: AbortSignal.timeout(5000) });
          if (r3.ok) {
            const p = await r3.json();
            if (p.extract) return `**${p.title}**\n\n${p.extract}`;
          }
        }
      }
    } catch { /* network error */ }
    return null;
  }

  // 3) Try native language Wikipedia first, then English
  const nativeResult = wikiLang !== "en" ? await tryWiki(base, healthQuery) : null;
  if (nativeResult) return `${nativeResult}\n\n_${srcNote}_`;

  const enResult = await tryWiki(enBase, healthQuery);
  if (enResult) return `${enResult}\n\n_Source: Wikipedia — Always consult a licensed doctor for medical advice._`;

  // 4) Final fallback: match against built-in articles
  const matched = ARTICLES.filter(a =>
    a.title.toLowerCase().includes(healthQuery.toLowerCase()) ||
    a.summary.toLowerCase().includes(healthQuery.toLowerCase()) ||
    a.tags.some(t => healthQuery.toLowerCase().includes(t))
  );
  if (matched.length > 0) {
    return `**${matched[0].title}**\n\n${matched[0].summary}\n\n${matched[0].content.join("\n")}\n\n_From local health library — switch to Articles tab for more topics._`;
  }
  return "I could not find specific information on that topic right now. Please switch to the **Articles** tab to browse offline health content, or consult a licensed healthcare worker.";
}

export default function HealthLibrary() {
  const { i18n } = useTranslation();
  const lang = i18n.language as "en" | "hi" | "mr";

  const [tab, setTab] = useState<"chat" | "articles">("chat");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Article | null>(null);

  // Translation state for ALL articles (list view)
  const [translatedArticles, setTranslatedArticles] = useState<Article[]>(ARTICLES);
  const [translatingList, setTranslatingList] = useState(false);
  const articlesCache = useRef<Map<string, Article[]>>(new Map());

  // Translation state for selected article detail view
  const [translatedArticle, setTranslatedArticle] = useState<{
    title: string;
    summary: string;
    content: string[];
    tags: string[];
  } | null>(null);
  const [translating, setTranslating] = useState(false);
  const translationCache = useRef<Map<string, { title: string; summary: string; content: string[]; tags: string[] }>>(new Map());

  const [messages, setMessages] = useState<ChatMessage[]>(() => restoreHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  useState(() => restoreSessionId()); // Initialize session
  const bottomRef = useRef<HTMLDivElement>(null);
  // HealthLibrary always uses MedlinePlus (NIH) + Wikipedia — not AWS Bedrock

  // Translate ALL articles list when language changes
  useEffect(() => {
    if (lang === "en") {
      setTranslatedArticles(ARTICLES);
      return;
    }

    // Check cache first
    if (articlesCache.current.has(lang)) {
      setTranslatedArticles(articlesCache.current.get(lang)!);
      return;
    }

    let cancelled = false;
    setTranslatingList(true);

    (async () => {
      try {
        const results: Article[] = [];
        for (const article of ARTICLES) {
          const [title, summary] = await Promise.all([
            freeTranslate(article.title, lang),
            freeTranslate(article.summary, lang),
          ]);
          const tags = await Promise.all(article.tags.map(t => freeTranslate(t, lang)));
          results.push({ ...article, title, summary, tags });
        }
        if (!cancelled) {
          articlesCache.current.set(lang, results);
          setTranslatedArticles(results);
        }
      } catch (err) {
        console.warn("[HealthLibrary] List translation failed:", err);
      } finally {
        if (!cancelled) setTranslatingList(false);
      }
    })();

    return () => { cancelled = true; };
  }, [lang]);

  // Translate article when selected and language is not English
  useEffect(() => {
    if (!selected) {
      setTranslatedArticle(null);
      return;
    }
    if (lang === "en") {
      setTranslatedArticle(null);
      return;
    }

    const cacheKey = `${selected.id}-${lang}`;
    if (translationCache.current.has(cacheKey)) {
      setTranslatedArticle(translationCache.current.get(cacheKey)!);
      return;
    }

    let cancelled = false;
    setTranslating(true);

    (async () => {
      try {
        const [title, summary, ...contents] = await Promise.all([
          freeTranslate(selected.title, lang),
          freeTranslate(selected.summary, lang),
          ...selected.content.map(c => freeTranslate(c, lang)),
        ]);
        const tags = await Promise.all(selected.tags.map(t => freeTranslate(t, lang)));

        if (!cancelled) {
          const result = { title, summary, content: contents, tags };
          translationCache.current.set(cacheKey, result);
          setTranslatedArticle(result);
        }
      } catch (err) {
        console.warn("[HealthLibrary] Translation failed:", err);
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selected, lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", text: q, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      // Always use free APIs: MedlinePlus NIH first, then Wikipedia (language-aware)
      const answer = await searchWikipedia(q, lang);
      setMessages(prev => [...prev, { role: "assistant", text: answer, timestamp: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Sorry, could not connect. Please check your internet and try again.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    const initial: ChatMessage[] = [{
      role: "assistant",
      text: "Hello! I am HealthSathi - your community health assistant. Ask me any health question in English, Hindi, or Marathi.",
      timestamp: Date.now(),
    }];
    setMessages(initial);
    sessionStorage.removeItem(HISTORY_KEY);
  };

  const filtered = translatedArticles.filter(a => {
    // Use original ARTICLES for category matching (category is not translated)
    const original = ARTICLES.find(orig => orig.id === a.id);
    const matchCat = category === "all" || (original?.category === category);
    const q = search.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  if (selected) {
    // Use translated content if available, else original
    const displayArticle = translatedArticle ?? selected;

    return (
      <div className="min-h-full bg-hs-bg">
        <div className="sticky top-0 z-10 bg-white border-b border-hs-border px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="btn-icon border-0">
            <svg className="w-5 h-5 text-hs-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-hs-text truncate">{displayArticle.title}</h1>
            <p className="text-xs text-hs-text-secondary">
              {selected.readTime} read
              {translating && <span className="ml-2 text-hs-blue animate-pulse">Translating...</span>}
            </p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          <p className="text-sm text-hs-text-secondary">{displayArticle.summary}</p>
          <div className="flex flex-wrap gap-2">
            {displayArticle.tags.map((t, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-hs-blue-light text-hs-blue text-xs rounded-full">{t}</span>
            ))}
          </div>
          <div className="hs-card space-y-3">
            <div className="flex justify-end mb-1">
              <ReadAloudButton text={displayArticle.content.join(' ')} variant="light" />
            </div>
            {displayArticle.content.map((line, i) => {
              const isHeading = /^[A-Z\s]+:/.test(line);
              const parts = line.split(":");
              if (isHeading && parts.length > 1) {
                return (
                  <div key={i}>
                    <p className="text-xs font-bold text-hs-blue uppercase">{parts[0]}</p>
                    <p className="text-sm text-hs-text mt-0.5">{parts.slice(1).join(":").trim()}</p>
                  </div>
                );
              }
              return <p key={i} className="text-sm text-hs-text leading-relaxed">{line}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-hs-bg">
      <div className="sticky top-0 z-10 bg-white border-b border-hs-border px-4">
        <div className="flex items-center h-14 gap-3">
          <div className="flex-1">
            <h1 className="text-base font-bold text-hs-text">Health Library</h1>
            <p className="text-xs text-hs-text-secondary">AI assistant + offline articles</p>
          </div>
          <select
            value={lang}
            onChange={e => i18n.changeLanguage(e.target.value)}
            className="input-field py-1 px-2 text-xs w-auto">
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="mr">मराठी</option>
          </select>
        </div>
        <div className="flex border-b border-hs-border -mb-px">
          {(["chat", "articles"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2
                ${tab === t ? "border-hs-blue text-hs-blue" : "border-transparent text-hs-text-secondary"}`}>
              {t === "chat" ? "AI Chat" : "Articles"}
            </button>
          ))}
        </div>
      </div>

      {tab === "chat" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-hs-blue-light flex items-center justify-center mr-2 flex-shrink-0 mt-0.5 text-sm">H</div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm
                  ${msg.role === "user" ? "bg-hs-blue text-white rounded-tr-none" : "bg-white border border-hs-border rounded-tl-none"}`}>
                  {msg.role === "assistant" ? (
                    <>
                      <AiBubble text={msg.text} />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-hs-text-secondary">{formatTime(msg.timestamp)}</p>
                        <ReadAloudButton text={msg.text} variant="light" className="scale-90" />
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{msg.text}</p>
                      <p className="text-xs mt-1 text-blue-100">{formatTime(msg.timestamp)}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-hs-blue-light flex items-center justify-center mr-2 text-sm">H</div>
                <div className="bg-white border border-hs-border rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-hs-blue animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-hs-blue animate-bounce" style={{ animationDelay: "100ms" }} />
                    <span className="w-2 h-2 rounded-full bg-hs-blue animate-bounce" style={{ animationDelay: "200ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 2 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-hs-text-secondary mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-xs bg-hs-blue-light text-hs-blue px-3 py-1.5 rounded-full border border-hs-blue/20 hover:bg-hs-blue hover:text-white transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border-t border-hs-border px-4 py-3 flex gap-2 items-end">
            {messages.length > 1 && (
              <button onClick={clearChat} title="Clear chat" className="btn-icon border-hs-border flex-shrink-0 text-hs-text-secondary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <MicButton onResult={text => setInput(prev => (prev + " " + text).trim())} className="flex-shrink-0" />
            <textarea
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask a health question..."
              className="flex-1 input-field resize-none min-h-[40px] max-h-[100px] py-2"
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              className="btn-primary px-4 py-2 flex-shrink-0 disabled:opacity-40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {tab === "articles" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-2 space-y-3">
            <div className="flex gap-2 items-center">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..."
                className="input-field flex-1" />
              <MicButton onResult={text => setSearch(text)} />
              {translatingList && <span className="text-xs text-hs-blue animate-pulse">Translating...</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors
                    ${category === c.id ? "bg-hs-blue text-white border-hs-blue" : "bg-white text-hs-text border-hs-border"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-hs-text-secondary text-sm">No articles found</div>
            )}
            {filtered.map(a => (
              <button key={a.id} onClick={() => {
                // Use original article for content translation
                const original = ARTICLES.find(orig => orig.id === a.id);
                setSelected(original ?? a);
              }}
                className="hs-card w-full text-left hover:border-hs-blue/30 transition-colors">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-bold text-hs-text flex-1 mr-2">{a.title}</h3>
                  <span className="text-xs text-hs-text-secondary flex-shrink-0">{a.readTime}</span>
                </div>
                <p className="text-xs text-hs-text-secondary mt-1">{a.summary}</p>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {a.tags.map(t => (
                    <span key={t} className="px-1.5 py-0.5 bg-hs-bg text-hs-text-secondary text-xs rounded">{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
