import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In dev, calls to /api/* go straight to the local Express server so
      // .env only needs VITE_API_URL set for the deployed build.
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
