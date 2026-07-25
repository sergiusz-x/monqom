import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "MonqomUI",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      // Externalize peer dependencies so consumers bundle them once
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "react-i18next",
        /^react-i18next\//,
      ],
    },
    sourcemap: true,
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    pool: "threads",
  },
});
