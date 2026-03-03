import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This codebase currently uses `any` in many UI/data boundaries.
      // Keep lint signal focused on real issues instead of noisy typing churn.
      "@typescript-eslint/no-explicit-any": "off",

      // Setting local form state from props is a common pattern here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "functions/**",
    "opencode-gemini-auth/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
