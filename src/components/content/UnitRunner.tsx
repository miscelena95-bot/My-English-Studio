"use client";

import { useState } from "react";
import Link from "next/link";
import type { RealEnglishUnit } from "@/content/real-english/types";
import { saveUnitStep, submitUnitProduction } from "@/app/actions/content";
import { useActiveTimer } from "@/lib/client/useActiveTimer";
import { wordCount } from "@/lib/domain/text";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { ExerciseCard } from "@/components/exercises/ExerciseCard";
import { ListenButton } from "./ListenButton";
import { VoiceInput } from "@/components/speaking/VoiceInput";
import { SaveExpressionButton, SaveLibraryButton } from "@/components/vocab/VocabButtons";
import { ProductionFeedbackView } from "@/components/feedback/ProductionFeedbackView";
import type { ProductionFeedback } from "@/lib/ai/schemas";

const STEPS = ["Discover", "Key expressions", "Source", "Comprehension", "Practice", "Discuss", "Your response"];

export function UnitRunner({ unit, aiConfigured, savedKeys, voiceName, rate, completed }: { unit: RealEnglishUnit; aiConfigured: boolean; savedKeys: string[]; voiceName: string | null; rate: number; completed: boolean }) {
  const [step, setStep] = useState(0);
  const [showText, setShowText] = useState(unit.skill === "reading");
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ used: string[]; feedback: ProductionFeedback | null } | null>(null);
  const seconds = useActiveTimer();
  const fullText = unit.source.paragraphs?.join("\n\n") ?? "";

  function go(n: number) {
    void saveUnitStep(unit.id, STEPS[step]);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(withFeedback: boolean) {
    setBusy(true);
    setError(null);
    const r = await submitUnitProduction(unit.id, text, withFeedback, seconds(), spoken ? "spoken" : "typed");
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r.data);
  }

  return (
    <div className="stack-l">
      <nav className="tabs" aria-label="Unit steps">
        {STEPS.map((s, i) => (
          <button key={s} type="button" className="tab" aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
            {i + 1}. {s}
          </button>
        ))}
      </nav>
      {completed && step === 0 && <Notice tone="success">You&apos;ve completed this unit before. Doing it again with a new response is great recycling.</Notice>}

      {step === 0 && (
        <Card className="stack">
          <p className="lede mb-0">{unit.discover}</p>
          <p className="small"><strong>Objective:</strong> {unit.objective}</p>
          <div><Button variant="primary" onClick={() => go(1)}>Start</Button></div>
        </Card>
      )}

      {step === 1 && (
        <Card className="stack">
          <p className="small muted mb-0">Read these before the text. Save the ones you want to keep using.</p>
          <ul className="list">
            {unit.keyExpressions.map((k) => (
              <li key={k.phrase} className="row-between" style={{ alignItems: "flex-start" }}>
                <div><span className="phrase">{k.phrase}</span><div className="small muted">{k.meaning}</div></div>
                {k.libraryKey ? <SaveLibraryButton libraryKey={k.libraryKey} saved={savedKeys.includes(k.libraryKey)} source="real-english" sourceRef={unit.id} /> : <SaveExpressionButton phrase={k.phrase} definition={k.meaning} source="real-english" sourceRef={unit.id} />}
              </li>
            ))}
          </ul>
          <div><Button variant="primary" onClick={() => go(2)}>Continue to the {unit.skill === "listening" ? "listening" : "text"}</Button></div>
        </Card>
      )}

      {step === 2 && (
        <Card className="stack">
          <div className="row-between">
            <div>
              <h3 className="mb-0">{unit.source.title}</h3>
              {unit.source.author && <span className="small muted">{unit.source.author}</span>}
            </div>
            {fullText && <ListenButton text={fullText} voiceName={voiceName} rate={rate} />}
          </div>
          {unit.source.kind === "your-choice" ? (
            <Notice tone="info" title="Choose your source">{unit.source.choose}</Notice>
          ) : unit.skill === "listening" && !showText ? (
            <div className="stack-s">
              <p className="small">Listen once or twice without reading. Then answer the questions — and only read the text if you need to check.</p>
              <div><Button size="small" onClick={() => setShowText(true)}>Show the text</Button></div>
            </div>
          ) : (
            <div className="reading">{unit.source.paragraphs?.map((p) => <p key={p}>{p}</p>)}</div>
          )}
          <p className="tiny muted mb-0">
            {unit.source.note}
            {unit.source.url && <> · <a href={unit.source.url} target="_blank" rel="noreferrer">{unit.source.urlLabel ?? "Source"}</a></>}
          </p>
          <div><Button variant="primary" onClick={() => go(3)}>Comprehension questions</Button></div>
        </Card>
      )}

      {step === 3 && (
        <div className="stack">
          {unit.comprehension.map((ex, i) => <ExerciseCard key={ex.id} exercise={ex} index={i} total={unit.comprehension.length} aiConfigured={aiConfigured} />)}
          <div><Button variant="primary" onClick={() => go(4)}>Language practice</Button></div>
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          {unit.practice.map((ex, i) => <ExerciseCard key={ex.id} exercise={ex} index={i} total={unit.practice.length} aiConfigured={aiConfigured} />)}
          <div><Button variant="primary" onClick={() => go(5)}>Discuss</Button></div>
        </div>
      )}

      {step === 5 && (
        <Card className="stack">
          <p className="small muted mb-0">Think about these (or say your answers out loud). Choose one to answer fully in the next step — or discuss it with your AI partner.</p>
          <ol>{unit.discussion.map((q) => <li key={q}>{q}</li>)}</ol>
          <div className="row">
            <Button variant="primary" onClick={() => go(6)}>Write or say your response</Button>
            {aiConfigured && <Link className="btn" href="/speaking/new?scenario=free-conversation">Discuss it in a conversation</Link>}
          </div>
        </Card>
      )}

      {step === 6 && (
        <Card className="stack">
          <p className="mb-0"><strong>{unit.production.prompt}</strong></p>
          {unit.production.targets.length > 0 && <div className="chips">{unit.production.targets.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}</div>}
          <VoiceInput onTranscript={(t) => { setText((x) => (x ? `${x} ${t}` : t)); setSpoken(true); }} compact />
          <label className="sr-only" htmlFor="prod">Your response</label>
          <textarea id="prod" className="textarea" style={{ minHeight: 150 }} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row-between">
            <span className="small muted">{wordCount(text)} words · aim for {unit.production.minWords}+</span>
            <div className="row">
              <Button onClick={() => submit(false)} disabled={busy || wordCount(text) < 15}>Save and finish</Button>
              {aiConfigured && <Button variant="primary" onClick={() => submit(true)} disabled={busy || wordCount(text) < 15}>{busy ? <span className="spinner" /> : "Finish with tutor feedback"}</Button>}
            </div>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {result && (
            <div className="stack">
              <Notice tone="success" title="Unit complete">{result.used.length ? `You used: ${result.used.join(", ")}.` : "Saved."} Expressions you saved here will come back in your reviews.</Notice>
              {result.feedback && <ProductionFeedbackView fb={result.feedback} />}
              <div><Link className="btn" href="/real-english">More Real English</Link></div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
