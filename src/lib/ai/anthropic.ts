import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AIError, type AIProvider, type StructuredRequest } from "./provider";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string = DEFAULT_ANTHROPIC_MODEL,
    baseURL?: string,
  ) {
    // Worst case 2 × 60 s stays well inside a 300 s serverless function limit.
    this.client = new Anthropic({ apiKey, baseURL, timeout: 60_000, maxRetries: 1 });
  }

  async generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: req.maxTokens ?? 4000,
        system: req.system,
        messages: req.messages,
        output_config: { format: betaZodOutputFormat(req.schema), effort: req.effort ?? "low" },
        // If a safety classifier declines, let the API retry on its recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (response.stop_reason === "refusal") throw new AIError("Request declined", "refused");
      if (response.stop_reason === "max_tokens") throw new AIError("Response was cut off", "invalid-output");
      if (response.parsed_output == null) throw new AIError("Response did not match the expected format", "invalid-output");
      return response.parsed_output as z.infer<S>;
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AIError(e.message, "auth");
      if (e instanceof Anthropic.RateLimitError) throw new AIError(e.message, "rate-limit");
      if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError) throw new AIError(e.message, "bad-request");
      if (e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError) throw new AIError(e.message, "unavailable");
      // Zod/JSON parsing errors from the SDK helper
      throw new AIError(e instanceof Error ? e.message : "Unknown error", "invalid-output");
    }
  }
}
