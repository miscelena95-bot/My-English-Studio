"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changeSessionSettings, finishConversation, requestHint, sendLearnerMessage } from "@/app/actions/speaking";
import { speak, speechSynthesisSupported, stopSpeaking } from "@/lib/client/speech";
import { containsPhrase, wordCount } from "@/lib/domain/text";
import { Badge, Button, Notice } from "@/components/ui";
import { IconCheck, IconLightbulb, IconSend, IconVolume } from "@/components/ui/icons";
import { VoiceInput } from "./VoiceInput";
import type { InlineFeedback } from "@/lib/server/speaking";
import { KIND_LABEL } from "@/components/feedback/CorrectionList";

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  inputMode: string | null;
  feedback: unknown;
  isRetry: boolean;
}

export function ChatClient({
  sessionId,
  initialMessages,
  correctionMode,
  challenge,
  inputMode,
  targets,
  objectives,
  voiceName,
  speechRate,
}: {
  sessionId: number;
  initialMessages: ChatMessage[];
  correctionMode: "fluency" | "coaching" | "precision";
  challenge: boolean;
  inputMode: "text" | "voice";
  targets: string[];
  objectives: string[];
  voiceName: string | null;
  speechRate: number;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [spokenInput, setSpokenInput] = useState(false);
  const [retry, setRetry] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ hint: string; starters: string[]; source: string } | null>(null);
  const [mode, setMode] = useState(correctionMode);
  const [isChallenge, setChallenge] = useState(challenge);
  const [voice, setVoice] = useState(inputMode === "voice");
  const [readAloud, setReadAloud] = useState(inputMode === "voice");
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [ttsOk, setTtsOk] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTtsOk(speechSynthesisSupported());
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const say = useCallback(
    (m: ChatMessage) => {
      if (!ttsOk) return;
      if (speakingId === m.id) {
        stopSpeaking();
        setSpeakingId(null);
        return;
      }
      speak(m.content, { voiceName, rate: speechRate, onStart: () => setSpeakingId(m.id), onEnd: () => setSpeakingId(null) });
    },
    [ttsOk, speakingId, voiceName, speechRate],
  );

  const learnerTexts = messages.filter((m) => m.role === "learner").map((m) => m.content);
  const usedTargets = new Set(
    targets.filter(
      (t) =>
        learnerTexts.some((x) => containsPhrase(x, t.replace(/\.\.\.|…/g, ""))) ||
        messages.some((m) => ((m.feedback as InlineFeedback | null)?.usedTargetExpressions ?? []).some((u) => u.toLowerCase() === t.toLowerCase())),
    ),
  );

  async function send() {
    const content = text.trim();
    if (!content || pending) return;
    stopSpeaking();
    setPending(true);
    setError(null);
    setHint(null);
    const optimistic: ChatMessage = { id: -Date.now(), role: "learner", content, inputMode: spokenInput ? "spoken" : "typed", feedback: null, isRetry: retry };
    setMessages((m) => [...m, optimistic]);
    setText("");
    const r = await sendLearnerMessage(sessionId, content, spokenInput ? "spoken" : "typed", retry);
    setPending(false);
    setRetry(false);
    setSpokenInput(false);
    if (!r.ok) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText(content);
      setError(r.error);
      return;
    }
    const msgs = r.data.messages as ChatMessage[];
    setMessages(msgs);
    const last = msgs[msgs.length - 1];
    if (readAloud && last?.role === "tutor") say(last);
    input.current?.focus();
  }

  async function getHint() {
    setError(null);
    const r = await requestHint(sessionId);
    if (r.ok) setHint(r.data);
    else setError(r.error);
  }

  async function end() {
    setEnding(true);
    stopSpeaking();
    const r = await finishConversation(sessionId);
    if (!r.ok) setError(r.error);
    router.refresh();
  }

  async function updateMode(m: typeof mode) {
    setMode(m);
    await changeSessionSettings(sessionId, { correctionMode: m });
  }
  async function toggleChallenge(v: boolean) {
    setChallenge(v);
    await changeSessionSettings(sessionId, { challengeMode: v });
  }

  const onTranscript = useCallback((t: string) => {
    setText((x) => (x ? `${x} ${t}` : t));
    setSpokenInput(true);
    input.current?.focus();
  }, []);

  const learnerTurns = learnerTexts.length;
  const words = learnerTexts.reduce((s, x) => s + wordCount(x), 0);

  return (
    <div className="dash-grid">
      <section aria-label="Conversation" className="stack">
        <div className="chat" aria-live="polite">
          {messages.map((m, i) => {
            const fb = m.feedback as InlineFeedback | null;
            if (m.role === "tutor")
              return (
                <div key={m.id} className="stack-s" style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
                  <div className="bubble bubble-tutor">{m.content}</div>
                  <div className="row bubble-meta">
                    {i === 0 && <span>Scene opener</span>}
                    {ttsOk && (
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => say(m)} aria-label={speakingId === m.id ? "Stop audio" : "Play this message aloud"}>
                        <IconVolume size={15} /> {speakingId === m.id ? "Stop" : "Listen"}
                      </button>
                    )}
                    {fb?.hint && !isChallenge && <span>💡 {fb.hint}</span>}
                  </div>
                </div>
              );
            // learner message, followed by any inline correction the tutor gave for it
            const next = messages[i + 1];
            const corrections = (next?.feedback as InlineFeedback | null)?.corrections ?? [];
            return (
              <div key={m.id} className="stack-s" style={{ alignSelf: "flex-end", alignItems: "flex-end", display: "flex", flexDirection: "column", maxWidth: "100%" }}>
                <div className="bubble bubble-learner">{m.content}</div>
                <span className="bubble-meta">{m.inputMode === "spoken" ? "spoken (transcript)" : "typed"}{m.isRetry ? " · second try" : ""}</span>
                {mode !== "fluency" &&
                  corrections.map((c, k) => (
                    <div key={k} className="inline-correction">
                      <Badge tone={KIND_LABEL[c.kind].tone}>{KIND_LABEL[c.kind].label}</Badge> <span className="strike">{c.original}</span> → <strong>{c.corrected}</strong>
                      <div className="small muted">{c.explanation}</div>
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => { setText(m.content); setRetry(true); input.current?.focus(); }}>Try saying it again</button>
                    </div>
                  ))}
              </div>
            );
          })}
          {pending && (
            <div className="bubble bubble-tutor" aria-label="The tutor is replying">
              <span className="typing"><span /><span /><span /></span>
            </div>
          )}
          <div ref={bottom} />
        </div>

        {hint && (
          <Notice tone="info" title={hint.source === "tutor" ? "Hint" : "Hint from the scenario"}>
            <p>{hint.hint}</p>
            {hint.starters.length > 0 && (
              <div className="chips">
                {hint.starters.map((s) => (
                  <button key={s} type="button" className="badge badge-accent" style={{ border: 0, cursor: "pointer" }} onClick={() => setText((t) => (t ? `${t} ${s}` : s))}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        <div className="composer stack-s">
          {voice && <VoiceInput onTranscript={onTranscript} disabled={pending} compact />}
          <label className="sr-only" htmlFor="composer">Your message</label>
          <textarea
            id="composer"
            ref={input}
            className="textarea"
            style={{ minHeight: 76 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={voice ? "Your words appear here after you speak — check them, then send." : "Type as you would speak. Enter to send, Shift+Enter for a new line."}
            disabled={pending || ending}
          />
          <div className="row-between">
            <div className="row">
              <Button variant="primary" onClick={send} disabled={!text.trim() || pending || ending}>
                <IconSend size={16} /> Send
              </Button>
              {!isChallenge && (
                <Button variant="ghost" onClick={getHint} disabled={pending || ending}>
                  <IconLightbulb size={16} /> Hint
                </Button>
              )}
              {retry && <Badge tone="info">Second try</Badge>}
            </div>
            <Button onClick={end} disabled={pending || ending || learnerTurns === 0}>
              {ending ? <><span className="spinner" /> Writing your report…</> : "End & get feedback"}
            </Button>
          </div>
        </div>
      </section>

      <aside className="stack" aria-label="Session panel">
        <div className="card stack-s">
          <div className="card-title">Objectives</div>
          <ul className="small mb-0">{objectives.map((o) => <li key={o}>{o}</li>)}</ul>
        </div>
        {targets.length > 0 && (
          <div className="card stack-s">
            <div className="card-title">Target expressions</div>
            <ul className="list small">
              {targets.map((t) => (
                <li key={t} className="row" style={{ gap: 8 }}>
                  {usedTargets.has(t) ? <IconCheck color="var(--success)" aria-label="used" /> : <span style={{ width: 18 }} aria-hidden="true">○</span>}
                  <span style={{ color: usedTargets.has(t) ? "var(--ink-3)" : undefined }}>{t}</span>
                </li>
              ))}
            </ul>
            <span className="tiny muted">{usedTargets.size} of {targets.length} used</span>
          </div>
        )}
        <div className="card stack-s">
          <div className="card-title">Settings</div>
          <label className="label small" htmlFor="mode">Corrections</label>
          <select id="mode" className="select" value={mode} onChange={(e) => updateMode(e.target.value as typeof mode)}>
            <option value="fluency">Fluency — feedback at the end</option>
            <option value="coaching">Coaching — important errors at pauses</option>
            <option value="precision">Precision — detailed, immediate</option>
          </select>
          <label className="row small"><input type="checkbox" checked={isChallenge} onChange={(e) => toggleChallenge(e.target.checked)} /> Challenge mode (no hints, harder questions)</label>
          <label className="row small"><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Use the microphone</label>
          {ttsOk && <label className="row small"><input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} /> Read replies aloud</label>}
        </div>
        <div className="card stack-s small">
          <div className="card-title">This conversation</div>
          <span>{learnerTurns} turns · {words} words{learnerTurns ? ` · ${Math.round(words / learnerTurns)} words per turn` : ""}</span>
          <span className="tiny muted">Counts come from your messages. Speed, hesitation and pronunciation aren&apos;t measured.</span>
        </div>
      </aside>
    </div>
  );
}
