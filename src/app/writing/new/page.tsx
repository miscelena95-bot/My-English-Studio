import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWritingTask } from "@/content/writing/tasks";
import { newSubmission } from "@/app/actions/writing";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "New writing task" };

export default async function NewWriting({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const t = getWritingTask((await searchParams).task ?? "");
  if (!t) notFound();
  const start = newSubmission.bind(null, t.id);
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/writing", label: "Writing Workshop" }]} eyebrow="Writing task" title={t.title} lede={t.objective} />
      <Card className="stack">
        <dl className="stack-s" style={{ margin: 0 }}>
          <div><dt className="card-title" style={{ marginBottom: 2 }}>Audience</dt><dd style={{ margin: 0 }}>{t.audience}</dd></div>
          <div><dt className="card-title" style={{ marginBottom: 2 }}>Situation</dt><dd style={{ margin: 0 }}>{t.context}</dd></div>
          <div><dt className="card-title" style={{ marginBottom: 2 }}>Your task</dt><dd style={{ margin: 0 }}>{t.instructions}</dd></div>
        </dl>
        <div className="row"><Badge tone="info">{t.register} register</Badge><Badge>{t.words.min}–{t.words.max} words</Badge><Badge>difficulty {t.difficulty}/3</Badge></div>
        {t.usefulExpressions.length > 0 && (<div><div className="card-title">Optional useful expressions</div><div className="chips">{t.usefulExpressions.map((e) => <span key={e} className="badge badge-accent">{e}</span>)}</div></div>)}
        <form action={start}><button className="btn btn-primary" type="submit">Start writing</button></form>
      </Card>
    </div>
  );
}
