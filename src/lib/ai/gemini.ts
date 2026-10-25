import "server-only";
import { z } from "zod";
import { AIError, type AIProvider, type ChatTurn, type StructuredRequest } from "./provider";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.6-flash";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
// Worst case (two models × one try each, 60 s) stays well inside a 300 s serverless function limit.
const TIMEOUT_MS = 60_000;

interface GeminiError {
  error?: { code?: number; message?: string; status?: string; details?: { "@type"?: string; reason?: string; violations?: { quotaId?: string }[] }[] };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Gemini accepts a subset of JSON Schema; drop the keys it doesn't need. */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

function toContents(messages: ChatTurn[]) {
  return messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: GeminiError,
  ) {
    super(body.error?.message ?? `HTTP ${status}`);
  }
  get isDailyQuota() {
    return this.status === 429 && (this.body.error?.details ?? []).some((d) => (d.violations ?? []).some((v) => /PerDay/i.test(v.quotaId ?? "")));
  }
  get isInvalidKey() {
    return (
      this.status === 401 ||
      this.status === 403 ||
      (this.status === 400 && ((this.body.error?.details ?? []).some((d) => d.reason === "API_KEY_INVALID") || /api key/i.test(this.message)))
    );
  }
}

/**
 * Google Gemini via the REST API (free tier friendly). Uses structured JSON
 * output, then validates the result with the same Zod schema. If the primary
 * model is rate-limited, the request is retried once on the fallback model,
 * which has its own free daily quota.
 */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  private readonly baseURL: string;

  constructor(
    private readonly apiKey: string,
    readonly model: string = DEFAULT_GEMINI_MODEL,
    readonly fallbackModel: string | null = DEFAULT_GEMINI_FALLBACK_MODEL,
    baseURL?: string,
    private readonly onRequest?: (model: string) => Promise<void>,
  ) {
    this.baseURL = (baseURL || DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  async generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
    const models = [this.model, ...(this.fallbackModel && this.fallbackModel !== this.model ? [this.fallbackModel] : [])];
    let last: unknown;
    for (const model of models) {
      try {
        return await this.generateWith(model, req);
      } catch (e) {
        last = e;
        console.error(`[ai] gemini ${model} failed:`, e instanceof HttpError ? `HTTP ${e.status} ${e.body.error?.status ?? ""} ${e.message}` : e instanceof Error ? e.message : e);
        // Rate limits, overloaded models, server errors and timeouts move on to the next model; anything else is final.
        const retryable = (e instanceof HttpError && (e.status === 429 || e.status >= 500)) || (e instanceof AIError && e.kind === "unavailable");
        if (!retryable) break;
      }
    }
    throw toAIError(last);
  }

  private async generateWith<S extends z.ZodType>(model: string, req: StructuredRequest<S>): Promise<z.infer<S>> {
    let data: GeminiResponse;
    try {
      data = await this.call(model, req, true);
    } catch (e) {
      // Some models reject parts of a JSON schema: retry once with the schema described in the prompt instead.
      if (!(e instanceof HttpError && e.status === 400 && !e.isInvalidKey)) throw e;
      data = await this.call(model, req, false);
    }
    if (data.promptFeedback?.blockReason) throw new AIError(`Blocked: ${data.promptFeedback.blockReason}`, "refused");
    const candidate = data.candidates?.[0];
    const finish = candidate?.finishReason ?? "";
    if (/SAFETY|PROHIBITED|BLOCKLIST|RECITATION|SPII/.test(finish)) throw new AIError(`Blocked: ${finish}`, "refused");
    if (finish === "MAX_TOKENS") throw new AIError("Response was cut off", "invalid-output");
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
    } catch {
      throw new AIError("Response was not valid JSON", "invalid-output");
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success) throw new AIError("Response did not match the expected format", "invalid-output");
    return parsed.data;
  }

  private async call(model: string, req: StructuredRequest<z.ZodType>, nativeSchema: boolean): Promise<GeminiResponse> {
    const schema = toGeminiSchema(req.schema);
    const system = nativeSchema ? req.system : `${req.system}\n\nRespond with a single JSON object (no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(schema)}`;
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: toContents(req.messages),
      generationConfig: {
        responseMimeType: "application/json",
        ...(nativeSchema ? { responseJsonSchema: schema } : {}),
        // Thinking tokens count towards the output limit, so leave room for them.
        maxOutputTokens: (req.maxTokens ?? 4000) * 2,
        ...(req.effort === "low" || !req.effort ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    };
    let res: Response;
    try {
      res = await fetch(`${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new AIError(e instanceof Error ? e.message : "Network error", "unavailable");
    }
    const payload = (await res.json().catch(() => ({}))) as GeminiResponse & GeminiError;
    if (!res.ok) throw new HttpError(res.status, payload);
    // Count only requests that reached the model (rejected ones don't use the daily quota).
    await this.onRequest?.(model).catch((e: unknown) => console.error("[ai] usage counter:", e));
    return payload;
  }
}

function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof HttpError) {
    if (e.isInvalidKey) return new AIError(e.message, "auth");
    if (e.status === 429) return new AIError(e.message, e.isDailyQuota ? "quota" : "rate-limit");
    if (e.status === 400 || e.status === 404) return new AIError(e.message, "bad-request");
    return new AIError(e.message, "unavailable");
  }
  return new AIError(e instanceof Error ? e.message : "Unknown error", "unavailable");
}
