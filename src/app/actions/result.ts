import { AIError, userMessageFor } from "@/lib/ai/provider";
import { ZodError } from "zod";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; aiUnavailable?: boolean };

/** Run an action and turn failures into messages the learner can understand. */
export async function run<T>(fn: () => T | Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AIError) {
      console.error(`[ai] ${e.kind}: ${e.message}`);
      return { ok: false, error: userMessageFor(e), aiUnavailable: e.kind === "not-configured" };
    }
    if (e instanceof ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
