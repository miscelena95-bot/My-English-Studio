import "server-only";
import { recordAiRequest } from "@/lib/server/ai-usage";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic";
import { DEFAULT_GEMINI_FALLBACK_MODEL, DEFAULT_GEMINI_MODEL, GeminiProvider } from "./gemini";
import { AIError, type AIProvider } from "./provider";

let override: AIProvider | null | undefined;

/** Tests can inject a provider (e.g. a local stub) without touching env vars. */
export function setAIProviderForTests(p: AIProvider | null | undefined) {
  override = p;
}

/** Explicit AI_PROVIDER wins; otherwise whichever key is set (Anthropic first). */
function providerName(env = process.env): string {
  const explicit = env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit) return explicit;
  if (!env.ANTHROPIC_API_KEY?.trim() && env.GEMINI_API_KEY?.trim()) return "gemini";
  return "anthropic";
}

/** Gemini's free tier allows about 20 requests per model per day (check your own limits in AI Studio). */
function geminiFallback(env = process.env): string | null {
  const v = env.AI_FALLBACK_MODEL?.trim();
  if (v === "none") return null;
  return v || DEFAULT_GEMINI_FALLBACK_MODEL;
}

export function getAIProvider(): AIProvider | null {
  if (override !== undefined) return override;
  const provider = providerName();
  const model = process.env.AI_MODEL?.trim();
  const baseURL = process.env.AI_BASE_URL?.trim() || undefined;
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return null;
    return new AnthropicProvider(key, model || DEFAULT_ANTHROPIC_MODEL, baseURL);
  }
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return null;
    return new GeminiProvider(key, model || DEFAULT_GEMINI_MODEL, geminiFallback(), baseURL, recordAiRequest);
  }
  return null;
}

export function requireAI(): AIProvider {
  const p = getAIProvider();
  if (!p) throw new AIError("AI provider not configured", "not-configured");
  return p;
}

export function aiStatus() {
  const p = getAIProvider();
  const provider = providerName();
  const gemini = p instanceof GeminiProvider ? p : null;
  return {
    configured: !!p,
    provider: p?.id ?? provider,
    model: p?.model ?? null,
    supported: provider === "anthropic" || provider === "gemini",
    /** Models whose daily usage is counted, with the per-model free limit (Gemini only). */
    quota: gemini
      ? { models: [gemini.model, ...(gemini.fallbackModel && gemini.fallbackModel !== gemini.model ? [gemini.fallbackModel] : [])], perModelLimit: Number(process.env.AI_DAILY_LIMIT) || 20 }
      : null,
  };
}
