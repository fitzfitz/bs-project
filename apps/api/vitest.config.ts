import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/features/**/*.{service,handlers}.ts"],
      exclude: ["src/test/**"],
    },
    setupFiles: ["./src/test/setup.ts"],
  },
});
