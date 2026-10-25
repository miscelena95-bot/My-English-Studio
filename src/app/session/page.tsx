import type { Metadata } from "next";
import Link from "next/link";
import { buildPlan, recommendations, sessionStatus, todaySession } from "@/lib/server/insights";
import { startToday } from "@/app/actions/session";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";
import { Reflection } from "@/components/session/Reflection";

export const metadata: Metadata = { title: "Today's session" };

export default async function SessionPage() {
  const s = await todaySession();
  if (!s) {
    const plan = await buildPlan();
    return (
      <div className="page page-narrow">
        <PageHeader eyebrow="Today's session" title={plan.mission} lede={plan.objective} />
        <Card className="stack">
          <ol className="small">{plan.steps.map((st) => <li key={st.title}>{st.title} · {st.minutes} min — <span className="muted">{st.reason}</span></li>)}</ol>
          <form action={startToday} className="row">
            <button className="btn btn-primary" name="minutes" value={plan.minutes}>Start ({plan.minutes} min)</button>
            <button className="btn" name="minutes" value={10}>10 minutes</button>
            <button className="btn btn-ghost" name="minutes" value={40}>Extended (40)</button>
          </form>
        </Card>
      </div>
    );
  }
  const { plan, done, minutes } = await sessionStatus(s);
  const currentIdx = done.findIndex((d, i) => !d && plan.steps[i].kind !== "reflection");
  const allDone = currentIdx === -1;
  const next = (await recommendations())[0];
  return (
    <div className="page page-narrow">
      <PageHeader eyebrow={`Today's mission · ${plan.minutes} minutes`} title={plan.mission} lede={plan.objective}>
        <p className="small muted">Outcome: {plan.outcome}</p>
      </PageHeader>
      <div className="stack-l">
        <Card>
          <ol className="steps" aria-label="Session steps">
            {plan.steps.map((st, i) => (
              <li key={st.title}>
                <div className="step" data-done={done[i]} data-current={i === currentIdx}>
                  <span className="step-index" aria-hidden="true">{done[i] ? <IconCheck size={14} /> : i + 1}</span>
                  <div>
                    <div className="step-title">
                      {st.kind === "reflection" ? st.title : <Link href={st.href}>{st.title}</Link>}
                      <span className="sr-only">{done[i] ? " (done)" : ""}</span>
                    </div>
                    <div className="small muted">{st.reason}</div>
                  </div>
                  <span className="small muted">{st.minutes} min</span>
                </div>
              </li>
            ))}
          </ol>
          {!allDone && plan.steps[currentIdx] && (
            <div className="row" style={{ marginTop: 12 }}>
              <ButtonLink href={plan.steps[currentIdx].href} variant="primary">Go to step {currentIdx + 1}</ButtonLink>
              <span className="small muted">Steps tick off automatically when you complete the activity.</span>
            </div>
          )}
        </Card>

        <Card className="stack">
          <div className="row-between">
            <h2 className="mb-0">Summary</h2>
            <Badge tone="accent">{minutes} min of active practice so far</Badge>
          </div>
          <Reflection sessionId={s.id} completed={!!s.completedAt} early={!allDone} />
          {next && (
            <div>
              <div className="card-title" style={{ marginTop: 8 }}>Recommended next</div>
              <Link href={next.href}><strong>{next.title}</strong></Link>
              <p className="small muted mb-0">{next.reason}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
