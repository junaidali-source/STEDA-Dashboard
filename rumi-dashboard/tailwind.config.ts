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
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Rumi brand — see rumi-brand skill (Documents/Rumi Agents/agent-skills-taleemabad/skills/rumi-brand)
        navy: {
          DEFAULT: "#0E2058", // product primary
          dark: "#001F3F",    // canonical logo/brand navy
          light: "#24368F",
        },
        coral: {
          DEFAULT: "#F06E42", // product warm accent
        },
        gold: {
          DEFAULT: "#F5B301", // presentation/collateral warm accent
        },
      },
      borderRadius: {
        DEFAULT: "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
