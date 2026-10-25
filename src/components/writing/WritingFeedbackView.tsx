import type { WritingFeedback } from "@/lib/ai/schemas";
import { Badge, Card, ProgressBar } from "@/components/ui";
import { CorrectionList } from "@/components/feedback/CorrectionList";
import { SaveExpressionButton } from "@/components/vocab/VocabButtons";
import { RevealRevision } from "./DraftActions";

const SCORE_LABELS: Record<keyof WritingFeedback["scores"], string> = {
  grammar: "Grammar",
  vocabularyRange: "Vocabulary range",
  vocabularyAccuracy: "Vocabulary accuracy",
  sentenceStructure: "Sentence structure",
  coherence: "Coherence & cohesion",
  naturalness: "Naturalness",
  register: "Tone & register",
  taskCompletion: "Task completion",
};

export function WritingFeedbackView({ fb, submissionId, revising }: { fb: WritingFeedback; submissionId: number; revising: boolean }) {
  const errors = fb.annotations.filter((a) => a.kind === "error");
  const unnatural = fb.annotations.filter((a) => a.kind === "unnatural");
  const style = fb.annotations.filter((a) => a.kind === "style");
  return (
    <div className="stack-l fade-in">
      <Card className="stack">
        <div className="row-between">
          <h3 className="mb-0">Feedback</h3>
          <Badge tone={fb.taskCompletion.met ? "success" : "warning"}>{fb.taskCompletion.met ? "Task completed" : "Task partly completed"}</Badge>
        </div>
        <p className="mb-0">{fb.overall}</p>
        <p className="small muted mb-0">{fb.taskCompletion.comment}</p>
        {fb.progressNotes.length > 0 && (
          <div className="card card-flat">
            <div className="card-title">Compared with your previous draft</div>
            <ul className="small mb-0">{fb.progressNotes.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
      </Card>
      <Card className="stack">
        <h3 className="mb-0">Three priorities for your next draft</h3>
        <ol className="mb-0">{fb.priorities.map((p) => <li key={p}>{p}</li>)}</ol>
      </Card>
      <Card className="stack">
        <h3 className="mb-0">Errors ({errors.length})</h3>
        <CorrectionList items={errors} />
        {unnatural.length > 0 && (<><h3 className="mb-0" style={{ marginTop: 12 }}>Unnatural phrasing ({unnatural.length})</h3><CorrectionList items={unnatural} /></>)}
        {style.length > 0 && (<><h3 className="mb-0" style={{ marginTop: 12 }}>Optional improvements ({style.length})</h3><p className="small muted mb-0">Not mistakes — just ideas to sound more natural.</p><CorrectionList items={style} /></>)}
      </Card>
      {fb.naturalAlternatives.length > 0 && (
        <Card className="stack">
          <h3 className="mb-0">More natural ways to say it</h3>
          <ul className="list">
            {fb.naturalAlternatives.map((a) => (
              <li key={a.original} className="row-between">
                <span><span className="muted">{a.original}</span> → <strong>{a.alternative}</strong></span>
                <SaveExpressionButton phrase={a.alternative} definition={`A more natural way to say: “${a.original}”`} example={a.alternative} source="writing" sourceRef={`submission:${submissionId}`} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="stack">
        <h3 className="mb-0">Indicators</h3>
        {(Object.keys(SCORE_LABELS) as Array<keyof WritingFeedback["scores"]>).map((k) => (
          <div className="skill-row" key={k} style={{ gridTemplateColumns: "170px 1fr 40px" }}>
            <span className="small">{SCORE_LABELS[k]}</span>
            <ProgressBar value={fb.scores[k]} max={5} label={SCORE_LABELS[k]} />
            <span className="skill-value">{fb.scores[k]}/5</span>
          </div>
        ))}
        <p className="tiny muted mb-0">Informal indicators from the AI tutor to guide practice — not exam marks.</p>
      </Card>
      <Card className="stack">
        <h3 className="mb-0">Revised version</h3>
        <RevealRevision text={fb.revisedVersion} revising={revising} />
      </Card>
      <Card flat className="stack-s">
        <strong>Follow-up task</strong>
        <p className="mb-0">{fb.followUpTask}</p>
      </Card>
    </div>
  );
}
