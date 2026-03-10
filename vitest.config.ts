import { defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json" with { type: "json" };

export default defineConfig({
  test: {
    globals: true,
  },
  esbuild: {
    target: tsconfig.compilerOptions.target,
  },
});
