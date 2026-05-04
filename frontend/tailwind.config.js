/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: [
      {
        web3dark: {
          primary: "#6366f1",
          secondary: "#8b5cf6",
          accent: "#ec4899",
          neutral: "#1f2937",
          base: "#0f172a",
          info: "#0ea5e9",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
    ],
  },
  plugins: [require("daisyui")],
};
