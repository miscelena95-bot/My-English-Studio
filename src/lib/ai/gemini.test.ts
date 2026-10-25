import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { z } from "zod";
// @ts-expect-error — plain JS test double
import { server, calls } from "../../../e2e/mock-anthropic.mjs";
import { GeminiProvider, toGeminiSchema } from "./gemini";
import { AnswerCheck, TutorTurn } from "./schemas";

let base = "";
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const req = { task: "check", system: "sys", messages: [{ role: "user" as const, content: "hello" }, { role: "assistant" as const, content: "hi" }, { role: "user" as const, content: "x" }], schema: AnswerCheck };

describe("GeminiProvider (against a local test double)", () => {
  it("sends a structured-output request, skips thought parts and validates the result", async () => {
    const used: string[] = [];
    const p = new GeminiProvider("test-key", "gemini-3.8-flash", "gemini-3.6-flash", base, async (m) => void used.push(m));
    const out = await p.generate({ ...req, effort: "low" });
    expect(out).toEqual({ verdict: "correct", explanation: "This is a valid alternative.", corrected: null });
    const call = calls[calls.length - 1];
    expect(call.model).toBe("gemini-3.8-flash");
    expect(call.headers["x-goog-api-key"]).toBe("test-key");
    expect(call.body.systemInstruction.parts[0].text).toBe("sys");
    expect(call.body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(call.body.generationConfig.responseMimeType).toBe("application/json");
    expect(call.body.generationConfig.responseJsonSchema.properties.verdict.enum).toEqual(["correct", "acceptable", "incorrect"]);
    expect(call.body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(used).toEqual(["gemini-3.8-flash"]);
  });

  it("switches to the fallback model when the first one's daily quota is used up", async () => {
    const used: string[] = [];
    const p = new GeminiProvider("test-key", "exhausted-flash", "gemini-3.6-flash", base, async (m) => void used.push(m));
    const out = await p.generate({ ...req, schema: TutorTurn });
    expect(out.reply).toMatch(/example/);
    expect(calls.slice(-2).map((c: { model: string }) => c.model)).toEqual(["exhausted-flash", "gemini-3.6-flash"]);
    expect(used).toEqual(["gemini-3.6-flash"]);
  });

  it("also switches model when the first one is overloaded", async () => {
    const p = new GeminiProvider("test-key", "overloaded-flash", "gemini-3.6-flash", base);
    const out = await p.generate(req);
    expect(out.verdict).toBe("correct");
    expect(calls.slice(-2).map((c: { model: string }) => c.model)).toEqual(["overloaded-flash", "gemini-3.6-flash"]);
  });

  it("reports a used-up quota on both models as 'quota'", async () => {
    const p = new GeminiProvider("test-key", "exhausted-a", "exhausted-b", base);
    await expect(p.generate(req)).rejects.toMatchObject({ kind: "quota" });
  });

  it("falls back to a schema described in the prompt if the model rejects the JSON schema", async () => {
    const p = new GeminiProvider("test-key", "schema-strict-flash", null, base);
    const out = await p.generate(req);
    expect(out.verdict).toBe("correct");
    const call = calls[calls.length - 1];
    expect(call.body.generationConfig.responseJsonSchema).toBeUndefined();
    expect(call.body.systemInstruction.parts[0].text).toContain("JSON Schema");
  });

  it("maps an invalid key to 'auth' without retrying", async () => {
    const before = calls.length;
    const p = new GeminiProvider("wrong-key", "gemini-3.8-flash", "gemini-3.6-flash", base);
    await expect(p.generate(req)).rejects.toMatchObject({ kind: "auth" });
    expect(calls.length - before).toBe(1);
  });

  it("rejects output that doesn't match the schema", async () => {
    const p = new GeminiProvider("test-key", "gemini-3.8-flash", null, base);
    await expect(p.generate({ ...req, schema: z.object({ somethingElse: z.string() }) })).rejects.toMatchObject({ kind: "invalid-output" });
  });

  it("reports an unreachable service as unavailable", async () => {
    const p = new GeminiProvider("test-key", "gemini-3.8-flash", null, "http://127.0.0.1:9");
    await expect(p.generate(req)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("produces a JSON schema without the $schema key", () => {
    const s = toGeminiSchema(AnswerCheck);
    expect(s.$schema).toBeUndefined();
    expect(s.type).toBe("object");
  });
});
