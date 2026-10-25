/**
 * Checks every external link in the built-in content:  npm run check:links
 *
 * Proxy-aware: if HTTPS_PROXY / HTTP_PROXY are set (and the host isn't in
 * NO_PROXY), requests go through the proxy; otherwise they connect directly.
 * Node's built-in fetch ignores those variables, so we use undici's agent.
 */
import { EnvHttpProxyAgent, fetch } from "undici";
import { REAL_ENGLISH_UNITS } from "../src/content/real-english";

const proxied = !!(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy);
const dispatcher = new EnvHttpProxyAgent();

const urls = new Set<string>([
  "https://console.anthropic.com/",
  "https://open-platform.theguardian.com/access/",
  ...REAL_ENGLISH_UNITS.map((u) => u.source.url).filter((u): u is string => !!u),
]);

type Outcome = { kind: "ok" | "broken" | "unverified"; detail: string };

/** Walk the error's cause chain to find what actually went wrong. */
function classify(e: unknown): Outcome {
  const chain: Array<Error & { code?: string }> = [];
  for (let c = e as (Error & { code?: string; cause?: unknown }) | undefined, i = 0; c && i < 8; c = c.cause as typeof c, i++) chain.push(c);
  const proxy = chain.map((c) => c.message?.match(/Proxy response \((\d+)\)/)).find(Boolean);
  // A proxy refusing the tunnel (e.g. a network policy) says nothing about the link itself.
  if (proxy) return { kind: "unverified", detail: `proxy refused the connection (HTTP ${proxy[1]})` };
  const deepest = chain[chain.length - 1];
  if (deepest?.name === "TimeoutError" || deepest?.code === "UND_ERR_CONNECT_TIMEOUT") return { kind: "unverified", detail: "timed out" };
  return { kind: "broken", detail: deepest?.code ?? deepest?.message ?? "unknown error" };
}

console.log(proxied ? "Using the proxy from HTTPS_PROXY/HTTP_PROXY (NO_PROXY respected)." : "No proxy configured: connecting directly.");
const results: Outcome[] = [];
for (const url of urls) {
  let o: Outcome;
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", dispatcher, signal: AbortSignal.timeout(15000) });
    await res.body?.cancel();
    o = res.ok ? { kind: "ok", detail: String(res.status) } : { kind: "broken", detail: `HTTP ${res.status}` };
  } catch (e) {
    o = classify(e);
  }
  results.push(o);
  console.log({ ok: "OK        ", broken: "BROKEN    ", unverified: "UNVERIFIED" }[o.kind], url, o.kind === "ok" ? "" : `(${o.detail})`);
}
const broken = results.filter((r) => r.kind === "broken").length;
const unverified = results.filter((r) => r.kind === "unverified").length;
console.log(`\n${results.length - broken - unverified} OK, ${broken} broken, ${unverified} could not be checked.`);
if (unverified) console.log("Unverified links were blocked or timed out on this network — that is not evidence they are broken.");
// Exit codes: 0 all OK · 1 at least one broken link · 2 nothing broken, but some couldn't be checked.
process.exit(broken ? 1 : unverified ? 2 : 0);
