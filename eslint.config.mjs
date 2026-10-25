import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const config = [
  ...nextVitals,
  ...nextTs,
  // Every database call is async: a missing `await` would silently drop or reorder a write.
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: { "@typescript-eslint/no-floating-promises": "error", "@typescript-eslint/await-thenable": "error" },
  },
  { rules: { "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }] } },
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];

export default config;
