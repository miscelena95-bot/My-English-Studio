import "server-only";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic";
import { AIError, type AIProvider } from "./provider";

let override: AIProvider | null | undefined;

/** Tests can inject a provider (e.g. a local stub) without touching env vars. */
export function setAIProviderForTests(p: AIProvider | null | undefined) {
  override = p;
}

export function getAIProvider(): AIProvider | null {
  if (override !== undefined) return override;
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return null;
    return new AnthropicProvider(key, process.env.AI_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL, process.env.AI_BASE_URL?.trim() || undefined);
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
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  return {
    configured: !!p,
    provider: p?.id ?? provider,
    model: p?.model ?? null,
    supported: provider === "anthropic",
  };
}
