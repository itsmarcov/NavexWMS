import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
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
    },
  },
  plugins: [],
} satisfies Config;
