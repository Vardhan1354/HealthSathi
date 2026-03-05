/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Legacy palette (kept for existing pages) */
        navy: {
          DEFAULT: "#0f172a",
          light: "#1e293b",
          lighter: "#334155",
        },
        teal: {
          accent: "#0d9488",
          muted: "#5eead4",
        },
        brand: {
          violet: "#7c3aed",
          "violet-light": "#8b5cf6",
          indigo: "#4338ca",
          emerald: "#059669",
        },
        /* HealthSathi Design System */
        hs: {
          blue:    "#2563EB",
          "blue-light": "#EFF6FF",
          "blue-dark":  "#1D4ED8",
          green:   "#10B981",
          "green-light": "#ECFDF5",
          "green-dark":  "#059669",
          red:     "#DC2626",
          "red-light":   "#FEF2F2",
          "red-dark":    "#B91C1C",
          yellow:  "#F59E0B",
          "yellow-light":"#FFFBEB",
          "yellow-dark": "#D97706",
          purple:  "#9333EA",
          "purple-light":"#FAF5FF",
          "purple-dark": "#7E22CE",
          /* Grays */
          text:    "#1F2937",
          "text-secondary": "#4B5563",
          border:  "#D1D5DB",
          bg:      "#F3F4F6",
          white:   "#FFFFFF",
        },
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "soft-md": "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        card: "0 0 0 1px rgb(0 0 0 / 0.04), 0 8px 24px -4px rgb(0 0 0 / 0.10)",
        glow: "0 0 20px -5px rgb(13 148 136 / 0.40)",
        "glow-violet": "0 0 20px -5px rgb(124 58 237 / 0.35)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backgroundImage: {
        "gradient-health": "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0d9488 100%)",
        "gradient-card": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "gradient-teal": "linear-gradient(135deg, #0d9488 0%, #059669 100%)",
        "gradient-violet": "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)",
        "gradient-amber": "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        "gradient-rose": "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
        "gradient-sky": "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
      },
    },
  },
  plugins: [],
}