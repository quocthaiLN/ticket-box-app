import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    allowedHosts: [".ngrok-free.dev", ".ngrok-free.app"],
    proxy: {
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3001,
    allowedHosts: [".ngrok-free.dev", ".ngrok-free.app"]
  }
});
