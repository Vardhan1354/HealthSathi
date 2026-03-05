/**
 * TranslatableText
 * Renders any AI-generated result text with:
 *  - Inline "Translate to हिंदी / मराठी" buttons
 *  - Shows translated text in place; "Show original" to revert
 *  - Uses MyMemory free API (no cost, no AWS needed)
 *  - Auto-translates on mount if current language is not English
 *  - Syncs when parent updates text prop (e.g. after async translation)
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { freeTranslate, TRANSLATE_LANGS } from "../services/freeTranslate";
import ReadAloudButton from "./ReadAloudButton";

interface Props {
  /** The AI-generated text to display (may already be translated by parent) */
  text: string;
  /** Original English text for back-translation (optional — if not provided, text is treated as English) */
  originalText?: string;
  /** Custom class on the outer wrapper */
  className?: string;
  /** Show the read-aloud button (default true) */
  showReadAloud?: boolean;
}

export default function TranslatableText({ text, originalText, className = "", showReadAloud = true }: Props) {
  const { i18n } = useTranslation();
  const [displayText, setDisplayText] = useState(text);
  // If originalText is provided, the text was already translated by the parent
  const [activeLang, setActiveLang] = useState<string>(originalText ? i18n.language : "en");
  const [loading, setLoading] = useState<string | null>(null);
  // Store the English original for back-translation
  const englishRef = useRef<string>(originalText ?? text);

  // Sync displayText when text prop changes (parent translated it)
  useEffect(() => {
    setDisplayText(text);
    if (originalText) {
      englishRef.current = originalText;
      setActiveLang(i18n.language);
    } else {
      englishRef.current = text;
    }
  }, [text, originalText, i18n.language]);

  // Auto-translate on mount if language is not English and no originalText provided
  useEffect(() => {
    if (!originalText && i18n.language !== "en") {
      let cancelled = false;
      setLoading(i18n.language);
      freeTranslate(text, i18n.language, "en")
        .then(translated => {
          if (!cancelled) {
            setDisplayText(translated);
            setActiveLang(i18n.language);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(null); });
      return () => { cancelled = true; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTranslate = async (langCode: string) => {
    if (langCode === activeLang) return;

    if (langCode === "en") {
      setDisplayText(englishRef.current);
      setActiveLang("en");
      return;
    }

    setLoading(langCode);
    try {
      const translated = await freeTranslate(englishRef.current, langCode, "en");
      setDisplayText(translated);
      setActiveLang(langCode);
    } catch {
      // Graceful fallback — keep current
    } finally {
      setLoading(null);
    }
  };

  // Render text with light markdown parsing (bold, numbered, bullets)
  const renderParagraphs = (raw: string) =>
    raw.split(/\n\n+/).map((para, pi) => (
      <div key={pi} className="space-y-0.5">
        {para.split("\n").map((line, li) => {
          const numberedBold = line.match(/^(\d+)\.\s*\*\*(.+?)\*\*(.*)/);
          const bold = line.match(/^\*\*(.+?)\*\*(.*)/);
          const bullet = line.match(/^[-•]\s+(.*)/);
          if (numberedBold) return (
            <div key={li} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mt-1">
              <p className="text-sm font-bold text-blue-800">{numberedBold[1]}. {numberedBold[2]}</p>
              {numberedBold[3] && <p className="text-sm text-gray-700 mt-0.5">{numberedBold[3]}</p>}
            </div>
          );
          if (bold) return (
            <p key={li} className="text-sm">
              <span className="font-semibold text-gray-800">{bold[1]}</span>
              <span className="text-gray-600">{bold[2]}</span>
            </p>
          );
          if (bullet) return (
            <p key={li} className="text-sm text-gray-700 flex gap-1.5">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>{bullet[1]}
            </p>
          );
          return line.trim()
            ? <p key={li} className="text-sm text-gray-700 leading-relaxed">{line}</p>
            : null;
        })}
      </div>
    ));

  return (
    <div className={className}>
      {/* Language selector row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-gray-400">Translate:</span>

        {/* English (original) */}
        <button
          type="button"
          onClick={() => handleTranslate("en")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            activeLang === "en"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
          }`}
        >
          English
        </button>

        {TRANSLATE_LANGS.map(lang => (
          <button
            key={lang.code}
            type="button"
            onClick={() => handleTranslate(lang.code)}
            disabled={loading === lang.code}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              activeLang === lang.code
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-teal-400"
            } disabled:opacity-50`}
          >
            {loading === lang.code ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {lang.label}
              </span>
            ) : lang.label}
          </button>
        ))}

        {showReadAloud && (
          <div className="ml-auto">
            <ReadAloudButton text={displayText} variant="light" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {renderParagraphs(displayText)}
      </div>
    </div>
  );
}
