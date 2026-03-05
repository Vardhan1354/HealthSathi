// ─── Free API utilities (no key required) ────────────────────────────────────
// Used as fallback when VITE_API_BASE_URL is not configured.

import { apiUrl } from "./apiConfig";

// ─── OCR.SPACE — free public OCR API ─────────────────────────────────────────
// Free demo key 'helloworld' — 25,000 requests/month, no registration needed.

/**
 * Extract text from an image using OCR.
 * Primary: backend proxy /api/ocr (avoids CORS & mixed-content issues).
 * Fallback: direct OCR.space API call from browser.
 */
export async function ocrExtractText(file: File): Promise<string> {
  // ── Try backend proxy first ──
  try {
    const proxyForm = new FormData();
    proxyForm.append("file", file);
    const proxyRes = await fetch(apiUrl("/api/ocr"), {
      method: "POST",
      body: proxyForm,
    });
    if (proxyRes.ok) {
      const proxyData = await proxyRes.json();
      if (!proxyData.IsErroredOnProcessing && proxyData.ParsedResults?.length) {
        const text = (proxyData.ParsedResults as Array<{ ParsedText: string }>)
          .map(r => r.ParsedText)
          .join("\n")
          .trim();
        if (text) {
          console.log("[OCR] via backend proxy — got", text.length, "chars");
          return text;
        }
      }
      console.warn("[OCR] backend proxy returned no text, falling back to direct");
    }
  } catch (e) {
    console.warn("[OCR] backend proxy failed, falling back to direct:", e);
  }

  // ── Fallback: direct OCR.space call from browser ──
  const form = new FormData();
  form.append("apikey", "helloworld");
  form.append("file", file);
  form.append("language", "eng");
  form.append("isTable", "true");
  form.append("OCREngine", "2");
  form.append("scale", "true");

  let res: Response;
  try {
    res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form,
    });
  } catch {
    // Engine 2 might fail — try Engine 1
    const form1 = new FormData();
    form1.append("apikey", "helloworld");
    form1.append("file", file);
    form1.append("language", "eng");
    form1.append("isTable", "true");
    form1.append("OCREngine", "1");
    form1.append("scale", "true");
    res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form1,
    });
  }

  if (!res.ok) throw new Error(`OCR.space HTTP ${res.status}`);
  const data = await res.json();

  if (data.IsErroredOnProcessing) {
    // Retry with Engine 1
    const form1 = new FormData();
    form1.append("apikey", "helloworld");
    form1.append("file", file);
    form1.append("language", "eng");
    form1.append("isTable", "true");
    form1.append("OCREngine", "1");
    form1.append("scale", "true");
    const res1 = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form1,
    });
    if (!res1.ok) throw new Error(`OCR.space Engine 1 HTTP ${res1.status}`);
    const data1 = await res1.json();
    if (data1.IsErroredOnProcessing) throw new Error(data1.ErrorMessage?.[0] || "OCR failed");
    return (data1.ParsedResults as Array<{ ParsedText: string }>)
      .map(r => r.ParsedText)
      .join("\n")
      .trim();
  }

  return (data.ParsedResults as Array<{ ParsedText: string }>)
    .map(r => r.ParsedText)
    .join("\n")
    .trim();
}

// ─── OPEN FOOD FACTS / RXNORM — medicine lookup ───────────────────────────────

export async function lookupMedicineInfo(name: string): Promise<{
  genericName: string;
  brandName: string;
  manufacturer: string;
  purpose: string;
  warnings: string;
  dosage: string;
  route: string;
} | null> {
  if (!name.trim()) return null;
  try {
    const q = encodeURIComponent(name.trim());
    const res = await fetch(
      `https://api.fda.gov/drug/label.json?search=generic_name:"${q}"+brand_name:"${q}"&limit=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      // Try broader search
      const res2 = await fetch(
        `https://api.fda.gov/drug/label.json?search=${q}&limit=1`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res2.ok) return null;
      const d2 = await res2.json();
      if (!d2.results?.length) return null;
      return extractFdaLabel(d2.results[0]);
    }
    const data = await res.json();
    if (!data.results?.length) return null;
    return extractFdaLabel(data.results[0]);
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFdaLabel(r: any) {
  return {
    genericName: r.openfda?.generic_name?.[0] ?? r.generic_name?.[0] ?? "Unknown",
    brandName: r.openfda?.brand_name?.[0] ?? r.brand_name?.[0] ?? "—",
    manufacturer: r.openfda?.manufacturer_name?.[0] ?? "—",
    purpose: (r.purpose?.[0] ?? r.indications_and_usage?.[0] ?? "").slice(0, 400),
    warnings: (r.warnings?.[0] ?? r.warnings_and_cautions?.[0] ?? "").slice(0, 400),
    dosage: (r.dosage_and_administration?.[0] ?? "").slice(0, 300),
    route: r.openfda?.route?.[0] ?? "—",
  };
}

// ─── OPENFDA RECALL CHECK ─────────────────────────────────────────────────────

export interface RecallResult {
  recalled: boolean;
  product: string;
  reason: string;
  status: string;
  date: string;
}

export async function checkDrugRecall(query: string): Promise<RecallResult | null> {
  if (!query.trim()) return null;
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(
      `https://api.fda.gov/drug/enforcement.json?search=product_description:"${q}"&limit=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { recalled: false, product: query, reason: "No recalls found", status: "Verified", date: "—" };
    const data = await res.json();
    if (!data.results?.length) return { recalled: false, product: query, reason: "No active recalls found in FDA database", status: "Clear", date: "—" };
    const r = data.results[0];
    return {
      recalled: r.status !== "Completed",
      product: r.product_description?.slice(0, 120) ?? query,
      reason: r.reason_for_recall?.slice(0, 200) ?? "Unknown reason",
      status: r.status ?? "Unknown",
      date: r.recall_initiation_date ?? "—",
    };
  } catch {
    return null;
  }
}

// ─── EXTRACT MEDICINE NAMES FROM OCR TEXT ────────────────────────────────────

export function extractMedicineNames(text: string): string[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const meds: string[] = [];
  // Common patterns: "Paracetamol 500mg", "Tab. Amoxycillin", "Inj XYZ"
  const medPattern = /(?:tab(?:let)?s?\.?|cap(?:sule)?s?\.?|inj(?:ection)?\.?|syp\.?|susp\.?)?\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+(\d+\s*(?:mg|mcg|ml|g|IU))/gi;
  for (const line of lines) {
    let m;
    // Reset lastIndex for each line since we reuse the same regex
    medPattern.lastIndex = 0;
    while ((m = medPattern.exec(line)) !== null) {
      meds.push(m[1].trim());
    }
  }
  // Also look for capitalised words OR ALL-CAPS words that likely are medicine names
  if (meds.length === 0) {
    for (const line of lines) {
      if (/\b\d+\s*(?:mg|mcg|ml|g|IU)\b/i.test(line) || /\bTab\b/i.test(line) || /\bCap\b/i.test(line) || /\bInj\b/i.test(line)) {
        // Match Title Case words OR ALL-CAPS words (3+ letters)
        const words = line.match(/[A-Z][a-z]{2,}|[A-Z]{3,}/g);
        if (words) {
          // Normalize to title case
          meds.push(...words.slice(0, 2).map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ));
        }
      }
    }
  }
  // Last resort: grab any word ≥4 chars on a line with a number
  if (meds.length === 0) {
    for (const line of lines) {
      if (/\d/.test(line)) {
        const words = line.match(/[A-Za-z]{4,}/g);
        if (words) {
          // Filter out common non-medicine words
          const skip = /^(each|with|take|dose|once|twice|daily|tablet|capsule|injection|before|after|meal|morning|night|water|batch|date|mfg|exp|strip|pack|store|below|keep|away|children|light|protect|manufacture|company|india|limited|pvt|ltd)$/i;
          const filtered = words.filter(w => !skip.test(w));
          if (filtered.length > 0) {
            meds.push(filtered[0].charAt(0).toUpperCase() + filtered[0].slice(1).toLowerCase());
          }
        }
      }
    }
  }
  return [...new Set(meds)].slice(0, 10);
}

// ─── PARSE LAB REPORT TEXT ────────────────────────────────────────────────────

interface LabTestParsed {
  name: string;
  value: string;
  unit: string;
  normalRange: string;
  status: "normal" | "mild" | "critical";
}

const LAB_PATTERNS = [
  // "Haemoglobin   10.2   g/dL   12-16"
  { re: /haem(?:o)?globin|hgb|hb/i,       normal: "12–16 (F), 13–17 (M)", unit: "g/dL", low: 7, high: 20 },
  { re: /wbc|white\s+blood\s+cell|leuco/i, normal: "4–11",               unit: "x10³/µL", low: 2, high: 30 },
  { re: /platelet|plt/i,                   normal: "150–400",            unit: "x10³/µL", low: 50, high: 600 },
  { re: /blood\s+sugar|glucose|bsl|rbs|fbs/i, normal: "70–100 (fasting)", unit: "mg/dL", low: 40, high: 200 },
  { re: /creatinin/i,                      normal: "0.6–1.2",            unit: "mg/dL", low: 0, high: 5 },
  { re: /urea|bun/i,                       normal: "10–45",              unit: "mg/dL", low: 0, high: 100 },
  { re: /sodium|na\s/i,                    normal: "135–145",            unit: "mEq/L", low: 120, high: 160 },
  { re: /potassium|k\s/i,                  normal: "3.5–5.0",           unit: "mEq/L", low: 2.5, high: 7 },
  { re: /bilirubin/i,                      normal: "0.3–1.2",            unit: "mg/dL", low: 0, high: 10 },
  { re: /cholesterol/i,                    normal: "<200",               unit: "mg/dL", low: 0, high: 400 },
];

export function parseLabReport(text: string): LabTestParsed[] {
  const results: LabTestParsed[] = [];
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    for (const pat of LAB_PATTERNS) {
      if (!pat.re.test(line)) continue;
      // Extract numeric value from the line
      const numMatch = line.match(/(\d+(?:\.\d+)?)/);
      if (!numMatch) continue;
      const val = parseFloat(numMatch[1]);
      let status: "normal" | "mild" | "critical" = "normal";
      // Rough status based on deviation from expected range
      const mid = (pat.low + pat.high) / 2;
      const dev = Math.abs(val - mid) / (pat.high - pat.low);
      if (dev > 0.6) status = "critical";
      else if (dev > 0.35) status = "mild";

      results.push({
        name: pat.re.source.split("|")[0].replace(/\\s\+/g, " ").replace(/[()\\b/i?]/g, "").trim(),
        value: numMatch[1],
        unit: pat.unit,
        normalRange: pat.normal,
        status,
      });
      break;
    }
  }
  return results;
}

// ─── BUILD FRIENDLY MEDICINE SCAN EXPLANATION ────────────────────────────────

export function buildMedicineScanExplanation(
  ocrText: string,
  fdaInfo: ReturnType<typeof extractFdaLabel> | null
): string {
  const medicines = extractMedicineNames(ocrText);
  const primaryName = medicines[0] ?? ocrText.split("\n")[0]?.slice(0, 40) ?? "this medicine";

  if (!fdaInfo) {
    return `**${primaryName}**\n\nExtracted text from your medicine image:\n${ocrText.slice(0, 400)}\n\n⚠️ Could not fetch full drug information from FDA database. Please consult a pharmacist for details.\n\n*Scanned via OCR.space · FDA lookup via OpenFDA*`;
  }

  const parts: string[] = [
    `**${fdaInfo.brandName !== "—" ? fdaInfo.brandName : primaryName}** (${fdaInfo.genericName})`,
    `**Manufacturer:** ${fdaInfo.manufacturer}`,
    `**Route:** ${fdaInfo.route}`,
  ];
  if (fdaInfo.purpose) parts.push(`\n**Purpose:**\n${fdaInfo.purpose}`);
  if (fdaInfo.dosage)  parts.push(`\n**Dosage:**\n${fdaInfo.dosage}`);
  if (fdaInfo.warnings) parts.push(`\n**Warnings:**\n${fdaInfo.warnings}`);
  parts.push("\n*Source: OpenFDA Drug Labeling Database · OCR by OCR.space*");
  return parts.join("\n");
}
