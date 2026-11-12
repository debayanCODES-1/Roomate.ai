import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172420",
        forest: "#315b49",
        sage: "#eaf0e9",
        paper: "#f7f8f5",
        citrus: "#d8f36a"
      },
      boxShadow: {
        card: "0 28px 80px rgba(27, 47, 37, 0.13)"
      }
    }
  },
  plugins: []
};

export default config;
