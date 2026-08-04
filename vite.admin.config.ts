import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build config for the Admin app (Playnite.Admin.exe).
// Outputs to ./dist/admin which is embedded by the shared client tauri.conf.json
// (admin bin loads it via window url "admin/index.html").
export default defineConfig(async () => ({
  root: "admin",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
  ],
  build: {
    outDir: "../dist/admin",
    emptyOutDir: false,
  },
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
