import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { rules: { "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }] } },
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];

export default config;
