import type { ProductionFeedback } from "@/lib/ai/schemas";
import { Badge } from "@/components/ui";
import { CorrectionList } from "./CorrectionList";

const VERDICT = { good: { label: "Well done", tone: "success" as const }, "minor-issues": { label: "Good, with a few points", tone: "accent" as const }, "needs-work": { label: "Worth another try", tone: "warning" as const } };

export function ProductionFeedbackView({ fb }: { fb: ProductionFeedback }) {
  return (
    <div className="stack fade-in">
      <div className="row"><Badge tone={VERDICT[fb.verdict].tone}>{VERDICT[fb.verdict].label}</Badge>{fb.usedTargets.length > 0 && <span className="small muted">Used well: {fb.usedTargets.join(", ")}</span>}</div>
      <p className="mb-0">{fb.comment}</p>
      <CorrectionList items={fb.corrections} />
      {fb.betterVersion && (
        <details className="disclosure">
          <summary className="small">See a lightly improved version (try fixing it yourself first)</summary>
          <p className="serif" style={{ fontSize: "1.05rem" }}>{fb.betterVersion}</p>
        </details>
      )}
      <p className="tiny muted mb-0">Feedback from the AI tutor. Errors (not optional suggestions) were added to your mistake tracker.</p>
    </div>
  );
}
