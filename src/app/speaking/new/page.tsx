import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getScenario } from "@/content/speaking/scenarios";
import { startConversation } from "@/app/actions/speaking";
import { getProfile } from "@/lib/server/profile";
import { aiStatus } from "@/lib/ai";
import { recyclableExpressions } from "@/lib/server/learner-context";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { RadioCards } from "@/components/onboarding/OnboardingForm";

export const metadata: Metadata = { title: "New conversation" };

export default async function NewConversation({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const s = getScenario((await searchParams).scenario ?? "");
  if (!s) notFound();
  const p = getProfile();
  const ai = aiStatus();
  // Adaptive: fluency for free conversation and discussion, the scenario's own default otherwise.
  const mode = p.correctionStyle === "adaptive" ? (s.category === "free" ? "fluency" : s.defaultCorrection) : p.correctionStyle;
  const recycled = recyclableExpressions(2);
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/speaking", label: "Speaking Studio" }]} eyebrow="Conversation" title={s.title} lede={s.summary} />
      {!ai.configured ? (
        <Notice tone="warning" title="AI conversations aren't configured">
          This role-play needs the AI partner. <Link href="/settings#ai">Set up an API key</Link>, or practise speaking now with a <Link href="/speaking/fluency">fluency drill</Link>.
        </Notice>
      ) : (
        <form action={startConversation} className="stack-l">
          <input type="hidden" name="scenarioId" value={s.id} />
          <Card className="stack-s">
            <p className="mb-0"><strong>Setting:</strong> {s.setting}</p>
            <p className="mb-0"><strong>Your partner:</strong> {s.tutorRole}</p>
            <p className="mb-0"><strong>You:</strong> {s.learnerRole}</p>
            <div><strong>Objectives</strong><ul className="mb-0">{s.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>
            {(s.targetExpressions.length > 0 || recycled.length > 0) && (
              <div>
                <strong>Try to use</strong>
                <div className="chips" style={{ marginTop: 6 }}>
                  {s.targetExpressions.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}
                  {recycled.map((t) => <Badge key={t} tone="clay" title="An expression you're learning">{t}</Badge>)}
                </div>
              </div>
            )}
          </Card>
          {s.category === "free" && (
            <div className="field">
              <label className="label" htmlFor="topic">Topic (optional)</label>
              <input id="topic" name="customTopic" className="input" maxLength={120} placeholder="e.g. a series I'm watching, my plans for the summer, a tricky client" />
            </div>
          )}
          <div className="field">
            <span className="label">Corrections during the conversation</span>
            <RadioCards
              name="correctionMode"
              value={mode}
              options={[
                { value: "fluency", label: "Fluency", help: "No interruptions. Full feedback in the report at the end." },
                { value: "coaching", label: "Coaching", help: "One important correction at natural pauses, then we carry on." },
                { value: "precision", label: "Precision", help: "Detailed corrections after each message." },
              ]}
            />
          </div>
          <div className="field">
            <span className="label">How will you speak?</span>
            <RadioCards
              name="inputMode"
              value={p.speakingMode === "text" ? "text" : "voice"}
              options={[
                { value: "voice", label: "Voice", help: "Microphone + spoken replies (Chrome, Edge or Safari). You can switch to typing at any time." },
                { value: "text", label: "Text", help: "Type as you would speak — quickly, without polishing." },
              ]}
            />
          </div>
          <label className="row small"><input type="checkbox" name="challenge" /> Challenge mode: no hints, more demanding questions</label>
          <div><button className="btn btn-primary" type="submit">Start the conversation</button></div>
        </form>
      )}
    </div>
  );
}
