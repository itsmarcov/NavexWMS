import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Tahoma", "Arial", "sans-serif"],
      },
      colors: {
        navex: {
          red: "#C81E1E",
          "red-dark": "#7F1414",
          "red-soft": "#FBE4E4",
          ink: "#0A0A0A",
          white: "#FFFFFF",
          stone: "#F5F5F4",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glass: "0 4px 30px rgba(0, 0, 0, 0.04)",
        "glass-md": "0 8px 32px rgba(0, 0, 0, 0.06)",
        "glass-lg": "0 12px 40px rgba(0, 0, 0, 0.08)",
        "glow-red": "0 0 24px rgba(200, 30, 30, 0.12)",
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.05), 0 10px 20px -2px rgba(0, 0, 0, 0.03)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
