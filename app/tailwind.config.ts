import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f4ff",
          100: "#dde2ff",
          200: "#bdc5ff",
          300: "#95a0ff",
          400: "#6e79ff",
          500: "#545ef5",
          600: "#3d45d6",
          700: "#3137a8",
          800: "#272d83",
          900: "#1f2668",
          950: "#101236",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        glow: "0 0 45px rgba(84, 94, 245, 0.35)",
      },
      borderRadius: {
        "4xl": "2.5rem",
      },
      animation: {
        "slow-spin": "spin 10s linear infinite",
        shimmer: "shimmer 2.4s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
