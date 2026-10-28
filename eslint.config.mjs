/**
 * ESLint Configuration (Flat Config)
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Build artifacts and environment declaration ignores
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling: pentest venv/runs and agent caches, not app code
    "strix-env/**",
    "strix_runs/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
