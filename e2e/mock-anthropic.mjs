// Test double for the Anthropic Messages API and the Gemini generateContent API,
// used ONLY by the tests.
// It returns schema-shaped JSON so the real SDK, parsing and validation code
// paths run end-to-end. It is never used by the application itself.
import http from "node:http";

const port = Number(process.env.MOCK_AI_PORT || 4010);
export const calls = [];

function lastUser(body) {
  const m = [...body.messages].reverse().find((x) => x.role === "user");
  return typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
}

function respond(body) {
  const props = Object.keys(body.output_config?.format?.schema?.properties ?? {});
  const has = (...k) => k.every((x) => props.includes(x));
  const text = lastUser(body);
  if (has("reply", "corrections", "hint")) {
    const corrections = [];
    if (/depends from/i.test(text)) corrections.push({ original: "depends from", corrected: "depends on", explanation: "We say depend on.", kind: "error", category: "prepositions" });
    // A hallucinated correction that the app must filter out (not in the learner's text).
    corrections.push({ original: "I goed to the moon", corrected: "I went to the moon", explanation: "Irregular past.", kind: "error", category: "grammar" });
    return { reply: "I see. And why do you think that? Could you give me an example from your work?", corrections, hint: null, usedTargetExpressions: [] };
  }
  if (has("hint", "starters")) return { hint: "Think about one advantage and one disadvantage.", starters: ["On the one hand,", "The main reason is that"] };
  if (has("summary", "strengths", "followUpTask")) {
    return {
      summary: "You discussed remote work and its effect on work-life balance.",
      strengths: ["You gave a clear opinion with a reason."],
      corrections: [
        { original: "It depends from the person", corrected: "It depends on the person", explanation: "depend on, not depend from.", kind: "error", category: "prepositions" },
        { original: "Totally invented sentence", corrected: "x", explanation: "x", kind: "error", category: "grammar" },
      ],
      naturalAlternatives: [],
      usefulExpressions: [{ phrase: "strike a balance", meaning: "find a good compromise", example: "It's hard to strike a balance between work and family." }],
      grammarPatterns: [{ pattern: "depend on", explanation: "Always use on after depend." }],
      fluencyTip: "Try to add an example after each opinion.",
      followUpTask: { instruction: "Answer again using two new expressions.", targetExpressions: ["strike a balance"] },
    };
  }
  if (has("overall", "annotations", "revisedVersion")) {
    const original = (text.match(/CURRENT DRAFT[^\n]*\n([\s\S]*)$/) || [, ""])[1];
    const firstWords = original.split(/\s+/).slice(0, 4).join(" ");
    return {
      overall: "A clear, polite email with a few issues.",
      taskCompletion: { met: true, comment: "You explained the change and proposed a solution." },
      scores: { grammar: 3, vocabularyRange: 3, vocabularyAccuracy: 4, sentenceStructure: 3, coherence: 4, naturalness: 3, register: 4, taskCompletion: 4 },
      annotations: [
        { original: firstWords, corrected: firstWords.replace(/^\w+/, "Hello"), explanation: "A test annotation quoting the learner.", kind: "unnatural", category: "register" },
        ...(/In attachment/i.test(original) ? [{ original: "In attachment you find", corrected: "Please find attached", explanation: "Natural email phrase.", kind: "error", category: "naturalness" }] : []),
      ],
      priorities: ["Use natural email phrases.", "Check prepositions.", "Shorter sentences."],
      naturalAlternatives: [],
      revisedVersion: "Dear client, the revised version.",
      followUpTask: "Write a second short email using “Please find attached”.",
      progressNotes: /PREVIOUS DRAFT/.test(text) ? ["You fixed the attachment phrase."] : [],
    };
  }
  if (has("verdict", "explanation", "corrected")) return { verdict: "correct", explanation: "This is a valid alternative.", corrected: null };
  if (has("verdict", "comment", "betterVersion")) return { verdict: "minor-issues", comment: "Good effort with clear ideas.", corrections: [], betterVersion: null, usedTargets: [], estimatedBand: /level impression/.test(text) ? "B1+" : null };
  if (has("summary", "comprehensionQuestions")) return { summary: "s", keyExpressions: [{ phrase: "p", meaning: "m" }], comprehensionQuestions: [{ question: "q", options: ["a", "b", "c", "d"], answerIndex: 1, explanation: "e" }], discussionQuestions: ["d"], productionTask: "t" };
  return { error: "unknown schema" };
}

/** Gemini: same canned answers, translated from/to the generateContent format. */
function gemini(req, res, body) {
  const model = decodeURIComponent(req.url.match(/models\/([^:]+):generateContent/)?.[1] ?? "");
  calls.push({ url: req.url, headers: req.headers, body, model });
  const json = (status, payload) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(payload));
  if (req.headers["x-goog-api-key"] !== "test-key")
    return json(400, { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }] } });
  if (model.startsWith("exhausted"))
    return json(429, { error: { code: 429, message: "You exceeded your current quota.", status: "RESOURCE_EXHAUSTED", details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } });
  if (model.startsWith("schema-strict") && body.generationConfig?.responseJsonSchema)
    return json(400, { error: { code: 400, message: "Invalid JSON payload: unsupported schema keyword.", status: "INVALID_ARGUMENT" } });
  const system = body.systemInstruction?.parts?.[0]?.text ?? "";
  const schema = body.generationConfig?.responseJsonSchema ?? JSON.parse(system.match(/JSON Schema:\n(.*)$/s)?.[1] ?? "{}");
  const messages = (body.contents ?? []).map((c) => ({ role: c.role === "model" ? "assistant" : "user", content: c.parts.map((p) => p.text).join("") }));
  const out = respond({ messages, output_config: { format: { schema } } });
  json(200, { candidates: [{ content: { role: "model", parts: [{ text: "thinking…", thought: true }, { text: JSON.stringify(out) }] }, finishReason: "STOP" }], modelVersion: model });
}

const server = http.createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    if (req.method === "POST" && req.url.startsWith("/v1beta/models/")) return gemini(req, res, JSON.parse(data || "{}"));
    if (req.method !== "POST" || !req.url.startsWith("/v1/messages")) {
      res.writeHead(404).end();
      return;
    }
    const body = JSON.parse(data || "{}");
    calls.push({ url: req.url, headers: req.headers, body });
    const key = req.headers["x-api-key"] ?? String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (key !== "test-key") {
      res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
      return;
    }
    const out = respond(body);
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ id: "msg_test", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }),
    );
  });
});

if (process.argv[1] && process.argv[1].endsWith("mock-anthropic.mjs")) server.listen(port, () => console.log(`mock AI on ${port}`));
export { server };
