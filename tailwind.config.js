/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/renderer/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      maxHeight: {
        96: "24rem",
      },
      transitionDelay: {
        150: "150ms",
      },
      aspectRatio: {
        video: "16 / 9",
      },
      gridTemplateRows: {
        0: "0fr",
        1: "1fr",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
