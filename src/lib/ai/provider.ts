import type { z } from "zod";

export type Effort = "low" | "medium" | "high";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StructuredRequest<S extends z.ZodType> {
  /** Short name used in logs and error messages, e.g. "tutor-turn". */
  task: string;
  system: string;
  messages: ChatTurn[];
  schema: S;
  maxTokens?: number;
  effort?: Effort;
}

/**
 * Provider-neutral interface. Everything AI-related in the app goes through
 * this, so providers can be swapped without touching features.
 */
export interface AIProvider {
  readonly id: string;
  readonly model: string;
  generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly kind: "not-configured" | "auth" | "rate-limit" | "unavailable" | "refused" | "invalid-output" | "bad-request",
  ) {
    super(message);
    this.name = "AIError";
  }
}

/** Message safe to show to the learner. */
export function userMessageFor(e: unknown): string {
  if (e instanceof AIError) {
    switch (e.kind) {
      case "not-configured":
        return "The AI tutor isn't configured yet. Add an API key in .env.local (see Settings → AI & voice) to enable this feature.";
      case "auth":
        return "The AI provider rejected the API key. Please check ANTHROPIC_API_KEY in your configuration.";
      case "rate-limit":
        return "The AI provider is busy right now (rate limit). Please wait a moment and try again.";
      case "unavailable":
        return "The AI service is temporarily unavailable. Your work is saved — please try again in a minute.";
      case "refused":
        return "The tutor couldn't respond to this message. Try rephrasing it.";
      case "invalid-output":
        return "The tutor's response couldn't be checked properly, so it wasn't shown. Please try again.";
      case "bad-request":
        return "The request to the AI service was not accepted. Please try again; if it keeps happening, check the model name in your configuration.";
    }
  }
  return "Something went wrong while contacting the AI tutor. Please try again.";
}
