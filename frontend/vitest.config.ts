import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Keep unit tests independent from the production CSS and PWA pipeline. It makes
// test execution deterministic and avoids loading native stylesheet tooling.
export default defineConfig({
  test: {
    include: ["src/test/**/*.{test,spec}.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    pool: "threads",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@monqom/ui": fileURLToPath(
        new URL("../packages/ui/src", import.meta.url),
      ),
      "virtual:pwa-register/react": fileURLToPath(
        new URL("./src/test/pwa-register.ts", import.meta.url),
      ),
    },
  },
});
