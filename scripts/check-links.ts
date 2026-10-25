/**
 * Checks every external link in the built-in content. Run it on a machine with
 * normal internet access:  npm run check:links
 */
import { REAL_ENGLISH_UNITS } from "../src/content/real-english";

const urls = new Set<string>([
  "https://console.anthropic.com/",
  "https://open-platform.theguardian.com/access/",
  ...REAL_ENGLISH_UNITS.map((u) => u.source.url).filter((u): u is string => !!u),
]);

let failed = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
    console.log(res.ok ? "OK  " : "FAIL", res.status, url);
    if (!res.ok) failed++;
  } catch (e) {
    console.log("FAIL", "—", url, (e as Error).message);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
