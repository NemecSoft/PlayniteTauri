import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build config for the Admin app (Playnite.Admin.exe).
// Outputs to ./dist-admin (its OWN frontendDist, separate from the client's
// ./dist). The admin Tauri app (apps/admin) points its frontendDist here, so
// its window loads admin/index.html from this directory — never the client UI.
export default defineConfig(async () => ({
  root: "admin",
  // Relative base so asset URLs are portable regardless of host.
  base: "./",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
  ],
  build: {
    outDir: "../dist-admin",
    emptyOutDir: true,
  },
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    watch: {
      ignored: [
        "**/target/**",
        "**/dist/**",
        "**/dist-admin/**",
        "**/release/**",
        "**/admin_release/**",
        "**/node_modules/**",
      ],
    },
  },
}));
