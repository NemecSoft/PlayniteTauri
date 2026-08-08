import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react({
      // Enable React Compiler (babel-plugin-react-compiler)
      babel: {
        plugins: [
          ["babel-plugin-react-compiler", { target: "19" }],
        ],
      },
    }),
  ],

  // Vite options tailored for Tauri development.
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore cargo/build artifacts so it doesn't try to
      //    watch target/ (locked while rustc writes) or the green exe outputs.
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
