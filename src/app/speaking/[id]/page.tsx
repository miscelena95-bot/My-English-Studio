import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, type InlineFeedback } from "@/lib/server/speaking";
import { getProfile } from "@/lib/server/profile";
import { aiStatus } from "@/lib/ai";
import type { ConversationReport } from "@/lib/ai/schemas";
import { deleteConversation } from "@/app/actions/speaking";
import { formatDateTime, plural } from "@/lib/format";
import { wordCount } from "@/lib/domain/text";
import { Badge, ButtonLink, Card, Notice, PageHeader } from "@/components/ui";
import { ChatClient } from "@/components/speaking/ChatClient";
import { CorrectionList } from "@/components/feedback/CorrectionList";
import { FollowUp, RetryReport } from "@/components/speaking/ReportClient";
import { SaveExpressionButton } from "@/components/vocab/VocabButtons";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getSession(Number((await params).id));
  if (!data) notFound();
  const { session, messages, report, scenario } = data;
  const p = await getProfile();
  const ai = aiStatus().configured;

  if (session.status === "active")
    return (
      <div className="page">
        <PageHeader breadcrumbs={[{ href: "/speaking", label: "Speaking Studio" }]} eyebrow={`Role-play · you are ${scenario.learnerRole}`} title={session.title} lede={scenario.setting} />
        {!ai && <div style={{ marginBottom: 16 }}><Notice tone="warning">The AI tutor isn&apos;t configured any more, so this conversation can&apos;t continue. <Link href="/settings#ai">Configure it</Link>.</Notice></div>}
        <ChatClient
          sessionId={session.id}
          initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content, inputMode: m.inputMode, feedback: m.feedback, isRetry: m.isRetry }))}
          correctionMode={session.correctionMode as "fluency" | "coaching" | "precision"}
          challenge={session.challengeMode}
          inputMode={session.inputMode as "text" | "voice"}
          targets={session.targetExpressions}
          objectives={scenario.objectives}
          voiceName={p.voiceName}
          speechRate={p.speechRate}
        />
      </div>
    );

  const r = report?.report as ConversationReport | undefined;
  const learnerMsgs = messages.filter((m) => m.role === "learner");
  const inlineCount = messages.reduce((s, m) => s + ((m.feedback as InlineFeedback | null)?.corrections.length ?? 0), 0);
  const del = deleteConversation.bind(null, session.id);
  return (
    <div className="page">
      <PageHeader breadcrumbs={[{ href: "/speaking", label: "Speaking Studio" }]} eyebrow={`Feedback report · ${formatDateTime(session.startedAt)}`} title={session.title}>
        <div className="row">
          <Badge>{plural(session.learnerTurns, "turn")}</Badge>
          <Badge>{plural(session.learnerWords, "word")}</Badge>
          {session.learnerTurns > 0 && <Badge>{Math.round(session.learnerWords / session.learnerTurns)} words per turn</Badge>}
          <Badge tone="info">{session.correctionMode} mode</Badge>
          {session.inputMode === "voice" && <Badge tone="accent">voice</Badge>}
        </div>
      </PageHeader>
      <div className="dash-grid">
        <div className="stack-l">
          {session.learnerTurns === 0 ? (
            <Notice>This conversation ended before you said anything, so there&apos;s no report.</Notice>
          ) : !r ? (
            <Card className="stack">
              <h2>Your report isn&apos;t ready</h2>
              <p className="small muted">{ai ? "The report couldn't be generated (the AI service may have been busy). Your conversation is saved." : "AI feedback isn't configured, so a report can't be generated."}</p>
              {ai && <RetryReport sessionId={session.id} />}
            </Card>
          ) : (
            <>
              <Card className="stack">
                <h2 className="mb-0">What we talked about</h2>
                <p className="mb-0">{r.summary}</p>
                {r.strengths.length > 0 && <div><div className="card-title" style={{ marginTop: 8 }}>What worked</div><ul className="mb-0">{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
              </Card>
              <Card className="stack">
                <h2 className="mb-0">Most important corrections</h2>
                <p className="small muted mb-0">Your original words and corrected versions. “Unnatural” and “optional” are not grammar mistakes.</p>
                <CorrectionList items={r.corrections} />
              </Card>
              {r.naturalAlternatives.length > 0 && (
                <Card className="stack">
                  <h2 className="mb-0">More natural alternatives</h2>
                  <ul className="list">{r.naturalAlternatives.map((a) => <li key={a.original}><span className="muted">{a.original}</span> → <strong>{a.alternative}</strong><div className="small muted">{a.note}</div></li>)}</ul>
                </Card>
              )}
              {r.usefulExpressions.length > 0 && (
                <Card className="stack">
                  <h2 className="mb-0">Useful expressions for next time</h2>
                  <ul className="list">
                    {r.usefulExpressions.map((e) => (
                      <li key={e.phrase} className="row-between" style={{ alignItems: "flex-start" }}>
                        <div><span className="phrase">{e.phrase}</span><div className="small muted">{e.meaning}</div><div className="small"><em>{e.example}</em></div></div>
                        <SaveExpressionButton phrase={e.phrase} definition={e.meaning} example={e.example} source="speaking" sourceRef={`session:${session.id}`} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {r.grammarPatterns.length > 0 && (
                <Card className="stack">
                  <h2 className="mb-0">Patterns to watch</h2>
                  <ul className="list">{r.grammarPatterns.map((g) => <li key={g.pattern}><strong>{g.pattern}</strong><div className="small">{g.explanation}</div></li>)}</ul>
                </Card>
              )}
              <Card flat className="stack-s"><strong>Fluency tip</strong><p className="mb-0">{r.fluencyTip}</p></Card>
              <Card className="stack">
                <h2 className="mb-0">Use it now</h2>
                <FollowUp sessionId={session.id} instruction={r.followUpTask.instruction} targets={r.followUpTask.targetExpressions} done={!!report?.followUpDone} previous={report?.followUpResponse ?? null} aiConfigured={ai} />
              </Card>
            </>
          )}
        </div>
        <aside className="stack">
          <Card className="stack-s">
            <div className="card-title">Next</div>
            <ButtonLink href={`/speaking/new?scenario=${scenario.id}`} variant="primary" size="small">Repeat this scenario</ButtonLink>
            <ButtonLink href="/session" size="small">Today&apos;s session</ButtonLink>
            <ButtonLink href="/mistakes/practice" size="small">Practise your mistakes</ButtonLink>
          </Card>
          {messages.length > 0 ? (
            <details className="disclosure">
              <summary className="small">Transcript ({learnerMsgs.length} of your messages{inlineCount ? `, ${inlineCount} inline corrections` : ""})</summary>
              <div className="stack-s small">
                {messages.map((m) => <p key={m.id} className="mb-0"><strong>{m.role === "learner" ? "You" : "Partner"}:</strong> {m.content} {m.role === "learner" && <span className="muted">({wordCount(m.content)} words)</span>}</p>)}
              </div>
            </details>
          ) : <p className="small muted">Transcript not stored (your privacy setting).</p>}
          <form action={del}><button className="btn btn-ghost btn-small btn-danger" type="submit">Delete this conversation</button></form>
        </aside>
      </div>
    </div>
  );
}
