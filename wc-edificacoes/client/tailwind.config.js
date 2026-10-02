/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2.5rem" }, screens: { "2xl": "1320px" } },
    extend: {
      fontFamily: {
        sans: ['"Archivo"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: { DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", 2: "rgb(var(--c-ink-2) / <alpha-value>)", 3: "rgb(var(--c-ink-3) / <alpha-value>)" },
        concrete: { DEFAULT: "rgb(var(--c-concrete) / <alpha-value>)", 2: "rgb(var(--c-concrete-2) / <alpha-value>)", 3: "rgb(var(--c-concrete-3) / <alpha-value>)" },
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        line: { DEFAULT: "rgb(var(--c-line) / <alpha-value>)", dark: "rgb(var(--c-line-dark) / <alpha-value>)" },
        signal: { DEFAULT: "rgb(var(--c-signal) / <alpha-value>)", strong: "rgb(var(--c-signal-strong) / <alpha-value>)", soft: "rgb(var(--c-signal-soft) / <alpha-value>)" },
        ok: "rgb(var(--c-ok) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        // aliases semânticos
        border: "rgb(var(--c-line) / <alpha-value>)",
        input: "rgb(var(--c-line) / <alpha-value>)",
        ring: "rgb(var(--c-signal-strong) / <alpha-value>)",
        background: "rgb(var(--c-concrete) / <alpha-value>)",
        foreground: "rgb(var(--c-ink) / <alpha-value>)",
        primary: { DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", foreground: "rgb(var(--c-paper) / <alpha-value>)" },
        secondary: { DEFAULT: "rgb(var(--c-concrete-2) / <alpha-value>)", foreground: "rgb(var(--c-ink) / <alpha-value>)" },
        destructive: { DEFAULT: "rgb(var(--c-danger) / <alpha-value>)", foreground: "#fff" },
        muted: { DEFAULT: "rgb(var(--c-concrete-2) / <alpha-value>)", foreground: "rgb(var(--c-ink-3) / <alpha-value>)" },
        accent: { DEFAULT: "rgb(var(--c-concrete-2) / <alpha-value>)", foreground: "rgb(var(--c-ink) / <alpha-value>)" },
        popover: { DEFAULT: "rgb(var(--c-paper) / <alpha-value>)", foreground: "rgb(var(--c-ink) / <alpha-value>)" },
        card: { DEFAULT: "rgb(var(--c-paper) / <alpha-value>)", foreground: "rgb(var(--c-ink) / <alpha-value>)" },
      },
      borderRadius: { lg: "4px", md: "3px", sm: "2px" },
      fontSize: {
        "display-xl": ["clamp(2.25rem, 6.4vw, 5.75rem)", { lineHeight: "0.92", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2.1rem, 4.6vw, 4rem)", { lineHeight: "0.98", letterSpacing: "-0.015em" }],
        "display-md": ["clamp(1.6rem, 3vw, 2.5rem)", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
