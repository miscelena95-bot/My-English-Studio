import { Badge } from "@/components/ui";
import { CATEGORY_LABELS, type MistakeCategory } from "@/lib/domain/mistake-categories";
import { diffWords } from "@/lib/domain/diff";
import type { Correction } from "@/lib/ai/schemas";

export const KIND_LABEL: Record<Correction["kind"], { label: string; tone: "danger" | "warning" | "info" }> = {
  error: { label: "Error", tone: "danger" },
  unnatural: { label: "Unnatural", tone: "warning" },
  style: { label: "Optional", tone: "info" },
};

export function InlineDiff({ from, to }: { from: string; to: string }) {
  return (
    <span>
      {diffWords(from, to).map((p, i) =>
        p.type === "same" ? <span key={i}>{p.text}</span> : p.type === "added" ? <ins key={i} className="ins">{p.text}</ins> : <del key={i} className="del">{p.text}</del>,
      )}
    </span>
  );
}

export function CorrectionList({ items }: { items: Correction[] }) {
  if (!items.length) return <p className="small muted mb-0">No corrections needed here.</p>;
  return (
    <ul className="list">
      {items.map((c, i) => (
        <li key={i} className="stack-s">
          <div className="row" style={{ gap: 6 }}>
            <Badge tone={KIND_LABEL[c.kind].tone}>{KIND_LABEL[c.kind].label}</Badge>
            <Badge>{CATEGORY_LABELS[c.category as MistakeCategory] ?? c.category}</Badge>
          </div>
          <div>
            <span className="strike">{c.original}</span> → <strong>{c.corrected}</strong>
          </div>
          <div className="small"><InlineDiff from={c.original} to={c.corrected} /></div>
          <div className="small muted">{c.explanation}</div>
        </li>
      ))}
    </ul>
  );
}
