import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: "rgb(var(--sand) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        clay: "rgb(var(--clay) / <alpha-value>)",
        moss: "rgb(var(--moss) / <alpha-value>)",
        mist: "rgb(var(--mist) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
export default config;
