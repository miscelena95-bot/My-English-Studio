import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubmission } from "@/lib/server/writing";
import { aiStatus } from "@/lib/ai";
import type { WritingFeedback } from "@/lib/ai/schemas";
import { removeSubmission } from "@/app/actions/writing";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { WritingEditor } from "@/components/writing/WritingEditor";
import { WritingFeedbackView } from "@/components/writing/WritingFeedbackView";
import { ReviseButton } from "@/components/writing/DraftActions";
import { InlineDiff } from "@/components/feedback/CorrectionList";
import { IconCheck, IconX } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Writing" };

export default async function SubmissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; compare?: string }> }) {
  const data = await getSubmission(Number((await params).id));
  if (!data) notFound();
  const sp = await searchParams;
  const { submission, drafts, task } = data;
  const current = drafts[drafts.length - 1];
  const viewing = drafts.find((d) => String(d.version) === sp.v) ?? current;
  const isCurrent = viewing.id === current.id;
  const editable = isCurrent && !current.feedbackSource;
  const feedbackDraft = [...drafts].reverse().find((d) => d.feedbackSource === "ai");
  const ai = aiStatus().configured;
  const compareWith = sp.compare ? drafts.find((d) => String(d.version) === sp.compare) : undefined;
  const del = removeSubmission.bind(null, submission.id);

  return (
    <div className="page">
      <PageHeader breadcrumbs={[{ href: "/writing", label: "Writing Workshop" }]} eyebrow={`${task.register} · ${task.words.min}–${task.words.max} words`} title={task.title} lede={task.instructions} />
      <div className="dash-grid">
        <div className="stack-l">
          {drafts.length > 1 && (
            <nav className="tabs" aria-label="Versions">
              {drafts.map((d) => (
                <Link key={d.id} href={`/writing/s/${submission.id}?v=${d.version}`} className="tab" aria-current={d.id === viewing.id ? "page" : undefined}>
                  Draft {d.version}{d.feedbackSource ? " ✓" : ""}
                </Link>
              ))}
            </nav>
          )}

          {editable ? (
            <Card>
              {drafts.length > 1 && feedbackDraft && <div style={{ marginBottom: 16 }}><Notice tone="info">You&apos;re revising. The feedback on draft {feedbackDraft.version} is below — fix what you can, then ask for feedback again to see what improved.</Notice></div>}
              <WritingEditor submissionId={submission.id} initial={current.text} min={task.words.min} max={task.words.max} checklist={task.checklist} aiConfigured={ai} version={current.version} />
            </Card>
          ) : (
            <Card className="stack-s">
              <div className="row-between"><span className="card-title mb-0">Draft {viewing.version} · {viewing.wordCount} words</span><span className="small muted">{formatDateTime(viewing.createdAt)}</span></div>
              <p className="serif" style={{ whiteSpace: "pre-wrap", fontSize: "1.1rem", lineHeight: 1.7 }}>{viewing.text}</p>
              {isCurrent && <div className="row"><ReviseButton submissionId={submission.id} /><span className="small muted">Creates draft {current.version + 1}, starting from this text.</span></div>}
            </Card>
          )}

          {viewing.feedbackSource === "checklist" && viewing.selfReview && (
            <Card className="stack-s">
              <h3 className="mb-0">Your self-review</h3>
              <ul className="list small">{task.checklist.map((c) => <li key={c} className="row">{viewing.selfReview![c] ? <IconCheck color="var(--success)" /> : <IconX color="var(--danger)" />} {c}</li>)}</ul>
              <p className="small muted mb-0">Unticked points are what to work on in your revision.</p>
            </Card>
          )}

          {(editable ? feedbackDraft : viewing.feedbackSource === "ai" ? viewing : null) && (
            <WritingFeedbackView fb={(editable ? feedbackDraft! : viewing).feedback as WritingFeedback} submissionId={submission.id} revising={drafts.length > 1} />
          )}

          {drafts.length > 1 && (
            <Card className="stack-s">
              <h3 className="mb-0">Compare drafts</h3>
              <div className="row small">
                {drafts.slice(0, -1).map((d) => (
                  <Link key={d.id} className="btn btn-small" href={`/writing/s/${submission.id}?v=${viewing.version}&compare=${d.version}`}>
                    Draft {d.version} → draft {viewing.version}
                  </Link>
                ))}
              </div>
              {compareWith && compareWith.id !== viewing.id && (
                <p className="serif" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                  <InlineDiff from={compareWith.text} to={viewing.text} />
                </p>
              )}
            </Card>
          )}
        </div>

        <aside className="stack">
          <Card className="stack-s">
            <div className="card-title">The task</div>
            <p className="small mb-0"><strong>Audience:</strong> {task.audience}</p>
            <p className="small mb-0"><strong>Situation:</strong> {task.context}</p>
            <p className="small mb-0"><strong>Objective:</strong> {task.objective}</p>
          </Card>
          {task.usefulExpressions.length > 0 && (
            <Card className="stack-s">
              <div className="card-title">Useful expressions</div>
              <ul className="small mb-0">{task.usefulExpressions.map((e) => <li key={e}>{e}</li>)}</ul>
            </Card>
          )}
          <Card className="stack-s">
            <div className="card-title">Status</div>
            <Badge tone="accent">{submission.status}</Badge>
            <span className="small muted">{drafts.length} version{drafts.length > 1 ? "s" : ""}</span>
            <form action={del}><button className="btn btn-ghost btn-small btn-danger" type="submit">Delete this piece</button></form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
