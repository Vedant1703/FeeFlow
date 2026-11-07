import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        paper: "var(--paper)",
        surface: "var(--surface)",
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
        },
        teal: {
          DEFAULT: "var(--teal)",
          d: "var(--teal-d)",
          t: "var(--teal-t)",
        },
        ok: {
          DEFAULT: "var(--ok)",
          t: "var(--ok-t)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          t: "var(--warn-t)",
        },
        bad: {
          DEFAULT: "var(--bad)",
          t: "var(--bad-t)",
        },
        info: {
          DEFAULT: "var(--info)",
          t: "var(--info-t)",
        },
        slate: {
          DEFAULT: "var(--slate)",
          t: "var(--slate-t)",
        },
      },
      fontSize: {
        amount: [
          "52px",
          {
            lineHeight: "56px",
            letterSpacing: "-0.035em",
            fontWeight: "650",
          },
        ],
      },
      borderRadius: {
        hero: "18px",
        panel: "12px",
        input: "8px",
      },
      boxShadow: {
        dialog: "0 30px 60px -20px rgba(0,0,0,.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

