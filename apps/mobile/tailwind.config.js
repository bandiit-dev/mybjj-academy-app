/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F6F7F9",
        foreground: "#0A0A0A",
        primary: "#0F172A",
        primaryForeground: "#FFFFFF",
        secondary: "#E2E8F0",
        secondaryForeground: "#1E293B",
        muted: "#EEF2F7",
        mutedForeground: "#64748B",
        border: "#E2E8F0",
        card: "#FFFFFF",
        cardForeground: "#0F172A",
        success: "#065F46",
        danger: "#B91C1C",
        warning: "#B45309"
      },
      borderRadius: {
        lg: "16px",
        md: "12px",
        sm: "8px"
      }
    }
  },
  plugins: []
};
