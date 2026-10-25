import Link from "next/link";
import { redirect } from "next/navigation";
import { dashboardData, buildPlan, sessionStatus, todaySession } from "@/lib/server/insights";
import { isOnboarded } from "@/lib/server/profile";
import { unfinishedActivity } from "@/lib/server/activity";
import { listSubmissions } from "@/lib/server/writing";
import { aiStatus } from "@/lib/ai";
import { startToday } from "@/app/actions/session";
import { Badge, ButtonLink, Card, CardLink, EmptyState, Notice, ProgressBar, SectionHead, Stat } from "@/components/ui";
import { IconArrowRight, IconClock } from "@/components/ui/icons";
import { greeting, pct, plural, relativeDay } from "@/lib/format";
import { CATEGORY_INFO } from "@/content/real-english";
import { CATEGORY_LABELS as SCENARIO_CATEGORIES } from "@/content/speaking/scenarios";

const SKILL_LABEL: Record<string, string> = { speaking: "Speaking", writing: "Writing", grammar: "Grammar", vocabulary: "Vocabulary", reading: "Reading", listening: "Listening" };

export default async function Home() {
  const d = await dashboardData();
  if (!isOnboarded(d.profile)) redirect("/welcome");
  const ai = aiStatus();
  const today = await todaySession();
  const status = today ? await sessionStatus(today) : null;
  const plan = status?.plan ?? await buildPlan();
  const doneCount = status ? status.done.filter(Boolean).length : 0;
  const activeConversation = d.recentSpeaking.find((s) => s.status === "active" && s.learnerTurns > 0);
  const unfinished = await unfinishedActivity();
  const draft = (await listSubmissions()).find((s) => s.status === "draft" && (s.latest?.wordCount ?? 0) > 0);
  const name = d.profile.name ? `, ${d.profile.name}` : "";
  const level = d.profile.estimatedLevel ?? d.profile.selfAssessedLevel;
  const onBreak = d.profile.breakUntil && d.profile.breakUntil >= new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <header className="page-header" style={{ maxWidth: "none" }}>
        <div className="eyebrow">My Learning Space</div>
        <div className="row-between" style={{ alignItems: "flex-end" }}>
          <h1 className="mb-0">
            {greeting()}
            {name}.
          </h1>
          <Link href="/progress" className="badge badge-accent" title="A provisional estimate based on your diagnostic and recent work — not an official certificate.">
            Estimated level: {level}
            {!d.profile.diagnosticCompletedAt && " (self-assessed)"}
          </Link>
        </div>
      </header>

      {onBreak && (
        <div style={{ marginBottom: 24 }}>
          <Notice tone="info" title={`You're on a break until ${d.profile.breakUntil}.`}>
            Your history and streak are safe. Come back whenever you like — <Link href="/settings">end the break</Link> any time.
          </Notice>
        </div>
      )}
      {!ai.configured && (
        <div style={{ marginBottom: 24 }}>
          <Notice tone="warning" title="AI tutor not configured">
            Exercises, reviews, grammar, the mistake tracker and progress all work. AI conversations and AI writing feedback need an API key —{" "}
            <Link href="/settings#ai">see how to set it up</Link>.
          </Notice>
        </div>
      )}

      <div className="dash-grid">
        <div className="stack-l">
          {/* ---------------------------------------------------- today's mission */}
          <Card className="card-feature stack" aria-labelledby="mission-title">
            <div className="row-between">
              <span className="eyebrow" style={{ color: "inherit", opacity: 0.85 }}>
                Today&apos;s mission · {plan.minutes} min
              </span>
              {status && (
                <span className="small">
                  {doneCount} of {plan.steps.length} steps done
                </span>
              )}
            </div>
            <h2 id="mission-title" className="mb-0" style={{ fontSize: "1.9rem" }}>
              {plan.mission}
            </h2>
            <p className="mb-0" style={{ opacity: 0.9 }}>
              {plan.objective}
            </p>
            {plan.why.length > 0 && (
              <div>
                <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.8, marginBottom: 4 }}>
                  Why this is useful for you
                </div>
                <ul className="small mb-0" style={{ opacity: 0.95 }}>
                  {plan.why.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <ol className="small mb-0" style={{ opacity: 0.95, paddingLeft: "1.1rem" }}>
              {plan.steps.map((s, i) => (
                <li key={s.title} style={{ textDecoration: status?.done[i] ? "line-through" : undefined }}>
                  {s.title} <span style={{ opacity: 0.7 }}>· {s.minutes} min</span>
                </li>
              ))}
            </ol>
            {status && <ProgressBar value={doneCount} max={plan.steps.length} label="Today's session progress" />}
            <div className="row" style={{ marginTop: 4 }}>
              {status ? (
                <ButtonLink href="/session" variant="primary">
                  {status.done.every(Boolean) ? "See today's summary" : "Continue today's session"} <IconArrowRight />
                </ButtonLink>
              ) : (
                <form action={startToday} className="row">
                  <button className="btn btn-primary" type="submit" name="minutes" value={plan.minutes}>
                    Start today&apos;s session <IconArrowRight />
                  </button>
                  {plan.minutes !== 10 && (
                    <button className="btn" type="submit" name="minutes" value={10} style={{ background: "transparent", color: "inherit", borderColor: "currentColor" }}>
                      Busy? 10-minute version
                    </button>
                  )}
                  {plan.minutes !== 40 && (
                    <button className="btn btn-ghost" type="submit" name="minutes" value={40} style={{ color: "inherit" }}>
                      Extended (40)
                    </button>
                  )}
                </form>
              )}
            </div>
          </Card>

          {activeConversation ? (
            <Card flat className="row-between">
              <div>
                <div className="card-title" style={{ marginBottom: 4 }}>
                  Pick up where you left off
                </div>
                <strong>Conversation: {activeConversation.title}</strong>
              </div>
              <ButtonLink href={`/speaking/${activeConversation.id}`} size="small">
                Continue
              </ButtonLink>
            </Card>
          ) : (unfinished || draft) && (
            <Card flat className="row-between">
              <div>
                <div className="card-title" style={{ marginBottom: 4 }}>
                  Pick up where you left off
                </div>
                <strong>{draft ? `Writing draft: ${draft.title}` : unfinished!.title}</strong>
              </div>
              <ButtonLink href={draft ? `/writing/s/${draft.id}` : continueHref(unfinished!)} size="small">
                Continue
              </ButtonLink>
            </Card>
          )}

          {/* ---------------------------------------------------- recommendations */}
          <section aria-labelledby="recs">
            <SectionHead id="recs" title="Recommended for you" />
            {d.recommendations.length ? (
              <div className="grid-2">
                {d.recommendations.slice(0, 4).map((r) => (
                  <CardLink key={r.id} href={r.href}>
                    <h3 style={{ fontSize: "1.1rem" }}>{r.title}</h3>
                    <p className="small muted mb-0">{r.reason}</p>
                  </CardLink>
                ))}
              </div>
            ) : (
              <EmptyState title="Recommendations appear as you practise">
                They&apos;re based only on your real results — mistakes that repeat, topics you master, expressions you haven&apos;t used yet. Complete today&apos;s session to get the first ones.
              </EmptyState>
            )}
          </section>

          {/* ---------------------------------------------------- skills */}
          <section aria-labelledby="skills">
            <SectionHead id="skills" title="Your skills" action={<Link href="/progress" className="small">Full progress</Link>} />
            <Card>
              {d.skills.map((s) => (
                <div className="skill-row" key={s.skill}>
                  <span>{SKILL_LABEL[s.skill]}</span>
                  {s.accuracy !== null ? (
                    <ProgressBar value={s.accuracy * 100} label={`${SKILL_LABEL[s.skill]} accuracy`} />
                  ) : (
                    <span className="tiny muted">{s.practice ? `${plural(s.practice, "activity", "activities")} in 30 days` : "No practice yet"}</span>
                  )}
                  <span className="skill-value">{s.accuracy !== null ? pct(s.accuracy) : s.minutes ? `${s.minutes} min` : ""}</span>
                </div>
              ))}
              <p className="tiny muted" style={{ marginTop: 14, marginBottom: 0 }}>
                Bars show accuracy on automatically graded exercises in the last 30 days (shown after 5 items). They describe recent performance, not your CEFR level.
              </p>
            </Card>
          </section>

          {/* ---------------------------------------------------- speaking */}
          <section aria-labelledby="speaking">
            <SectionHead id="speaking" title="Recent speaking" action={<Link href="/speaking" className="small">Speaking Studio</Link>} />
            {d.recentSpeaking.length ? (
              <div className="stack-s">
                {d.recentSpeaking.map((s) => (
                  <CardLink key={s.id} href={`/speaking/${s.id}`}>
                    <div className="row-between">
                      <span>
                        <strong>{s.title}</strong>
                        <span className="small muted"> · {SCENARIO_CATEGORIES[s.category as keyof typeof SCENARIO_CATEGORIES]?.label}</span>
                      </span>
                      <span className="small muted">
                        {s.status === "active" ? "in progress · " : ""}
                        {plural(s.learnerTurns, "turn")} · {plural(s.learnerWords, "word")} · {relativeDay(s.startedAt)}
                      </span>
                    </div>
                  </CardLink>
                ))}
              </div>
            ) : (
              <EmptyState title="No conversations yet" action={<ButtonLink href="/speaking">Open the Speaking Studio</ButtonLink>}>
                Speaking is your top priority. Start with a role-play from your work, or a free conversation.
              </EmptyState>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------- side column */}
        <aside className="stack-l" aria-label="Goals and reviews">
          <Card className="stack">
            <div className="card-title">This week</div>
            <div className="grid-2" style={{ gap: 12 }}>
              <Stat value={d.metrics.minutesThisWeek} label={`of ${d.profile.weeklyGoalMinutes} min goal`} />
              <Stat value={d.metrics.activeDaysThisWeek} label={`of ${d.profile.weeklyGoalSessions} active days`} />
            </div>
            <ProgressBar value={d.metrics.minutesThisWeek} max={d.profile.weeklyGoalMinutes} label="Weekly minutes goal" />
            <div className="row-between small">
              <span className="row" style={{ gap: 6 }}>
                <IconClock /> Today: {d.metrics.minutesToday} min
              </span>
              <span className="muted">{plural(d.metrics.activitiesThisWeek, "activity", "activities")}</span>
            </div>
            {d.profile.showStreak && d.metrics.streak > 0 && <p className="small mb-0">🔥 {plural(d.metrics.streak, "day")} in a row. Rest days never erase your history.</p>}
            <Link href="/settings#goals" className="tiny">
              Adjust goals or take a break
            </Link>
          </Card>

          <Card className="stack">
            <div className="card-title">Vocabulary</div>
            {d.vocab.total ? (
              <>
                <div className="row-between">
                  <Stat value={d.vocab.due} label="due for review" />
                  <Stat value={d.vocab.usedActively} label="used in your own work" />
                </div>
                <ButtonLink href="/vocabulary/review" variant={d.vocab.due ? "primary" : "secondary"} size="small">
                  {d.vocab.due ? "Review now" : "Nothing due — learn more"}
                </ButtonLink>
                <div>
                  <div className="tiny muted" style={{ marginBottom: 6 }}>
                    Recently saved
                  </div>
                  <ul className="list small">
                    {d.recentExpressions.map((e) => (
                      <li key={e.id}>
                        <Link href={`/vocabulary/collection/${e.id}`}>{e.phrase}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <>
                <p className="small muted mb-0">Your collection is empty. Add a set of expressions to start spaced repetition.</p>
                <ButtonLink href="/vocabulary" size="small">
                  Browse expression sets
                </ButtonLink>
              </>
            )}
          </Card>

          <Card className="stack">
            <div className="card-title">Recurring mistakes</div>
            {d.mistakes.length ? (
              <>
                <ul className="list small">
                  {d.mistakes.map((m) => (
                    <li key={m.category} className="row-between">
                      <span>{m.label}</span>
                      <span className="muted">
                        {m.active} active · seen {m.occurrences}×
                      </span>
                    </li>
                  ))}
                </ul>
                <ButtonLink href="/mistakes/practice" size="small">
                  Practise your mistakes
                </ButtonLink>
              </>
            ) : (
              <p className="small muted mb-0">Nothing tracked yet. Mistakes from exercises, conversations and writing will appear here so you can practise them again.</p>
            )}
          </Card>

          {d.content && (
            <CardLink href={`/real-english/${d.content.id}`}>
              <div className="card-title">Real English</div>
              <Badge tone="clay">{CATEGORY_INFO[d.content.category].label}</Badge>
              <h3 style={{ marginTop: 10 }}>{d.content.title}</h3>
              <p className="small muted mb-0">{d.content.objective}</p>
            </CardLink>
          )}

          {!d.profile.diagnosticCompletedAt && (
            <Card flat className="stack-s">
              <strong>Take the 10-minute diagnostic</strong>
              <span className="small muted">It sets a provisional level and tells the planner which grammar topics to prioritise.</span>
              <ButtonLink href="/welcome/diagnostic" size="small">
                Start the diagnostic
              </ButtonLink>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function continueHref(a: { kind: string; refId: string | null; meta: Record<string, unknown> | null }) {
  switch (a.kind) {
    case "grammar-practice":
      return `/grammar/${a.refId}/practice`;
    case "vocab-practice":
      return `/vocabulary/sets/${a.refId}`;
    case "vocab-review":
      return "/vocabulary/review";
    case "mistake-review":
      return "/mistakes/practice";
    default:
      return "/";
  }
}
