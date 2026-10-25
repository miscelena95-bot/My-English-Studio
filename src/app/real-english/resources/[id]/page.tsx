import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { aiStatus } from "@/lib/ai";
import type { ContentActivity } from "@/lib/ai/schemas";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { DeleteResource, GenerateActivity, GeneratedActivityView } from "@/components/content/ResourceClients";
import { IconExternal } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Resource" };

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const r = await getDb().select().from(schema.contentResources).where(eq(schema.contentResources.id, Number((await params).id))).get();
  if (!r) notFound();
  const ai = aiStatus().configured;
  const isNews = r.kind.startsWith("news:");
  const activity = r.generatedActivity as ContentActivity | null;
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: isNews ? "/real-english/news" : "/real-english", label: isNews ? "News" : "Real English" }]} eyebrow={isNews ? `${r.sourceName ?? "News"} · ${r.publishedAt ? formatDateTime(r.publishedAt) : ""}` : r.kind} title={r.title} />
      <div className="stack-l">
        <Card className="stack-s">
          {r.summary && <p className="mb-0">{r.summary}</p>}
          {r.learnerNotes && <p className="small mb-0" style={{ whiteSpace: "pre-wrap" }}><strong>Your notes/extract:</strong> {r.learnerNotes}</p>}
          <div className="row">
            {r.url && <a className="btn btn-small" href={r.url} target="_blank" rel="noreferrer">Open the original <IconExternal size={14} /></a>}
            {!isNews && <DeleteResource id={r.id} />}
          </div>
        </Card>
        {!activity && <GenerateActivity id={r.id} aiConfigured={ai} />}
        <GeneratedActivityView id={r.id} activity={activity} aiConfigured={ai} />
      </div>
    </div>
  );
}
