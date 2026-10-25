import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { z } from "zod";
// @ts-expect-error — plain JS test double
import { server, calls } from "../../../e2e/mock-anthropic.mjs";
import { AnthropicProvider } from "./anthropic";
import { AIError } from "./provider";
import { AnswerCheck, TutorTurn } from "./schemas";

let base = "";
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("AnthropicProvider (against a local test double)", () => {
  it("sends a structured-output request and parses the result", async () => {
    const p = new AnthropicProvider("test-key", "claude-opus-5-5", base);
    const out = await p.generate({ task: "check", system: "sys", messages: [{ role: "user", content: "hello" }], schema: AnswerCheck, effort: "low" });
    expect(out).toEqual({ verdict: "correct", explanation: "This is a valid alternative.", corrected: null });
    const req = calls[calls.length - 1];
    expect(req.body.model).toBe("claude-opus-5-5");
    expect(req.body.system).toBe("sys");
    expect(req.body.output_config.format.type).toBe("json_schema");
    expect(req.body.output_config.effort).toBe("low");
    expect(req.body.fallbacks).toBe("default");
    expect(String(req.headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
  });

  it("maps authentication failures to a typed error", async () => {
    const p = new AnthropicProvider("wrong-key", "claude-opus-5-5", base);
    await expect(p.generate({ task: "t", system: "s", messages: [{ role: "user", content: "x" }], schema: TutorTurn })).rejects.toMatchObject({ kind: "auth" });
  });

  it("rejects output that doesn't match the schema", async () => {
    const p = new AnthropicProvider("test-key", "claude-opus-5-5", base);
    const Strange = z.object({ somethingElse: z.string() });
    const err = await p.generate({ task: "t", system: "s", messages: [{ role: "user", content: "x" }], schema: Strange }).catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.kind).toBe("invalid-output");
  });

  it("reports an unreachable service as unavailable", async () => {
    const p = new AnthropicProvider("test-key", "claude-opus-5-5", "http://127.0.0.1:9");
    const err = await p.generate({ task: "t", system: "s", messages: [{ role: "user", content: "x" }], schema: AnswerCheck }).catch((e) => e);
    expect(err.kind).toBe("unavailable");
  }, 30000);
});
