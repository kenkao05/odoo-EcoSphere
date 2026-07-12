/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Named tokens rather than raw hex scattered through components —
        // change the brand accent in exactly one place if needed.
        esg: {
          env: "#2E9E5B",     // Environmental — green
          social: "#3B82C4",  // Social — blue
          gov: "#7C5CBF",     // Governance — purple
          overall: "#1F6FEB", // Overall ESG — deep blue
        },
        surface: {
          DEFAULT: "#F7F9F8",
          card: "rgba(255, 255, 255, 0.6)",
          border: "rgba(15, 23, 42, 0.08)",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      backdropBlur: { glass: "12px" },
      boxShadow: {
        glass: "0 4px 24px rgba(15, 23, 42, 0.06)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
