"use client";

import Link from "next/link";
import { useState } from "react";
import { submitDiagnostic } from "@/app/actions/profile";
import type { DiagnosticItem } from "@/content/diagnostic";
import { useActiveTimer } from "@/lib/client/useActiveTimer";
import { wordCount } from "@/lib/domain/text";
import { Button, ButtonLink, Card, Notice, ProgressBar } from "@/components/ui";
import { VoiceInput } from "@/components/speaking/VoiceInput";

type Step = "intro" | "grammar" | "vocabulary" | "writing" | "speaking" | "self" | "result";

export function Diagnostic({
  items,
  writingPrompt,
  speakingPrompt,
  skills,
  aiConfigured,
  topicTitles,
}: {
  items: DiagnosticItem[];
  writingPrompt: string;
  speakingPrompt: string;
  skills: ReadonlyArray<{ id: string; label: string }>;
  aiConfigured: boolean;
  topicTitles: Record<string, string>;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [writing, setWriting] = useState("");
  const [speaking, setSpeaking] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [self, setSelf] = useState<Record<string, number>>(() => Object.fromEntries(skills.map((s) => [s.id, 3])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ level: string; weakTopics: string[]; evidence: string[] } | null>(null);
  const seconds = useActiveTimer();

  const grammar = items.filter((x) => x.section === "grammar");
  const vocab = items.filter((x) => x.section === "vocabulary");
  const list = step === "grammar" ? grammar : vocab;
  const total = items.length + 3;
  const position = step === "intro" ? 0 : step === "grammar" ? i : step === "vocabulary" ? grammar.length + i : step === "writing" ? items.length : step === "speaking" ? items.length + 1 : items.length + 2;

  async function finish() {
    setBusy(true);
    setError(null);
    const r = await submitDiagnostic({ answers, writing, speaking, speakingMode: spoken ? "spoken" : "typed", self, seconds: seconds() });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r.data);
    setStep("result");
  }

  if (step === "intro")
    return (
      <Card className="stack">
        <h2>A short, low-pressure check</h2>
        <p className="lede">About 10 minutes: 12 grammar questions, 6 vocabulary questions, a short email, a short spoken (or typed) answer and a quick self-assessment.</p>
        <ul className="small">
          <li>There's no time limit and no feedback until the end, so just do your best.</li>
          <li>It's not an official CEFR test. It gives a provisional starting point that your real progress will update.</li>
          <li>If you don't know an answer, choose “I'm not sure” — that's useful information too.</li>
        </ul>
        {!aiConfigured && (
          <Notice tone="warning">
            The AI tutor isn&apos;t configured, so your writing and speaking samples will be saved but not assessed. The grammar and vocabulary parts are graded automatically.
          </Notice>
        )}
        <div className="row">
          <Button variant="primary" onClick={() => setStep("grammar")}>
            Start
          </Button>
          <ButtonLink href="/" variant="ghost">
            Maybe later
          </ButtonLink>
        </div>
      </Card>
    );

  if (step === "result" && result)
    return (
      <Card className="stack fade-in">
        <div className="eyebrow">Your provisional profile</div>
        <h2>Starting point: around {result.level}</h2>
        <p className="lede">This is an estimate from a short check, not a certificate. Your level will be re-assessed from what you actually do in the studio.</p>
        <div>
          <h4>What it's based on</h4>
          <ul className="small">
            {result.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
        {result.weakTopics.length > 0 && (
          <div>
            <h4>Topics to prioritise</h4>
            <div className="chips">
              {result.weakTopics.map((t) => (
                <Link key={t} href={`/grammar/${t}`} className="badge badge-clay">
                  {topicTitles[t] ?? t}
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="row">
          <ButtonLink href="/" variant="primary">
            Go to my learning space
          </ButtonLink>
        </div>
      </Card>
    );

  return (
    <div className="stack">
      <ProgressBar value={position} max={total} label="Diagnostic progress" thin />
      {(step === "grammar" || step === "vocabulary") && (
        <Card className="stack" key={list[i].id}>
          <div className="row-between small muted">
            <span>{step === "grammar" ? "Grammar" : "Vocabulary in context"}</span>
            <span>
              {i + 1} / {list.length}
            </span>
          </div>
          <p className="exercise-prompt">{list[i].prompt}</p>
          <div className="options" role="radiogroup" aria-label="Options">
            {[...list[i].options, "I'm not sure"].map((o, k) => {
              const value = k < list[i].options.length ? k : -1;
              const selected = answers[list[i].id] === value;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className="option"
                  data-state={selected ? "selected" : undefined}
                  onClick={() => {
                    setAnswers((a) => {
                      const n = { ...a };
                      if (value === -1) delete n[list[i].id];
                      else n[list[i].id] = value;
                      return n;
                    });
                    if (i + 1 < list.length) setI(i + 1);
                    else if (step === "grammar") {
                      setStep("vocabulary");
                      setI(0);
                    } else setStep("writing");
                  }}
                >
                  <span className="option-key">{value === -1 ? "?" : String.fromCharCode(65 + k)}</span>
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
          {i > 0 && (
            <div>
              <Button variant="ghost" size="small" onClick={() => setI(i - 1)}>
                Previous question
              </Button>
            </div>
          )}
        </Card>
      )}

      {step === "writing" && (
        <Card className="stack">
          <h3>Short writing task</h3>
          <p>{writingPrompt}</p>
          <label className="sr-only" htmlFor="diag-writing">
            Your email
          </label>
          <textarea id="diag-writing" className="textarea textarea-writing" value={writing} onChange={(e) => setWriting(e.target.value)} placeholder="Dear …" />
          <div className="row-between">
            <span className="small muted">{wordCount(writing)} words</span>
            <div className="row">
              <Button variant="ghost" onClick={() => setStep("speaking")}>
                Skip
              </Button>
              <Button variant="primary" onClick={() => setStep("speaking")} disabled={wordCount(writing) < 20}>
                Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "speaking" && (
        <Card className="stack">
          <h3>Speaking (or typing as you'd speak)</h3>
          <p>{speakingPrompt}</p>
          <VoiceInput
            onTranscript={(t) => {
              setSpeaking((s) => (s ? `${s} ${t}` : t));
              setSpoken(true);
            }}
          />
          <label className="label" htmlFor="diag-speaking">
            {spoken ? "Transcript (you can fix obvious recognition errors, but don't polish your English)" : "Your answer"}
          </label>
          <textarea id="diag-speaking" className="textarea" value={speaking} onChange={(e) => setSpeaking(e.target.value)} />
          <p className="tiny muted">Only the text is kept — audio is never recorded or stored by My English Studio.</p>
          <div className="row-between">
            <span className="small muted">{wordCount(speaking)} words</span>
            <div className="row">
              <Button variant="ghost" onClick={() => setStep("self")}>
                Skip
              </Button>
              <Button variant="primary" onClick={() => setStep("self")} disabled={wordCount(speaking) < 15}>
                Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "self" && (
        <Card className="stack">
          <h3>How confident do you feel?</h3>
          <p className="small muted">1 = very difficult · 5 = comfortable</p>
          {skills.map((s) => (
            <div className="field" key={s.id}>
              <label className="label" htmlFor={`self-${s.id}`}>
                {s.label}: <strong>{self[s.id]}</strong>
              </label>
              <input id={`self-${s.id}`} className="range" type="range" min={1} max={5} step={1} value={self[s.id]} onChange={(e) => setSelf((x) => ({ ...x, [s.id]: Number(e.target.value) }))} />
            </div>
          ))}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="row">
            <Button variant="primary" onClick={finish} disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" /> {aiConfigured ? "Analysing your answers…" : "Saving…"}
                </>
              ) : (
                "See my results"
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
