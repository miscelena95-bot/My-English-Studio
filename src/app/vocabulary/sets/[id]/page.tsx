import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVocabSet, libraryKey } from "@/content/vocabulary";
import { listCollection } from "@/lib/server/vocabulary";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { AddSetButton, SaveLibraryButton } from "@/components/vocab/VocabButtons";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: getVocabSet((await params).id)?.title ?? "Vocabulary" };
}

export default async function SetPage({ params }: { params: Promise<{ id: string }> }) {
  const set = getVocabSet((await params).id);
  if (!set) notFound();
  const saved = new Set((await listCollection()).map((e) => e.libraryId));
  const inCollection = set.entries.filter((e) => saved.has(libraryKey(set.id, e.id))).length;
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/vocabulary", label: "Vocabulary Lab" }]} eyebrow="Expression set" title={set.title} lede={set.description}>
        <p className="small"><strong>Why it matters for you:</strong> {set.why}</p>
        <div className="row" style={{ marginTop: 16 }}>
          <ButtonLink href={`/vocabulary/sets/${set.id}/practice`} variant="primary">Practise this set</ButtonLink>
          <AddSetButton setId={set.id} inCollection={inCollection} total={set.entries.length} />
        </div>
      </PageHeader>
      <div className="stack">
        {set.entries.map((e) => (
          <Card key={e.id} className="stack-s">
            <div className="row-between">
              <span className="phrase" style={{ fontSize: "1.3rem" }}>{e.phrase}</span>
              <span className="row">
                <Badge>{e.pos}</Badge>
                {e.register && <Badge tone="info">{e.register}</Badge>}
                <SaveLibraryButton libraryKey={libraryKey(set.id, e.id)} saved={saved.has(libraryKey(set.id, e.id))} />
              </span>
            </div>
            <p className="mb-0">{e.definition}</p>
            {(e.stress || e.ipa) && <p className="small muted mb-0">Pronunciation: {[e.stress, e.ipa].filter(Boolean).join(" · ")}</p>}
            <ul className="small mb-0">{e.examples.map((x) => <li key={x}><em>{x}</em></li>)}</ul>
            <details className="disclosure">
              <summary className="small">Collocations, register and common mistakes</summary>
              <div className="stack-s small">
                {e.collocations?.length ? <p className="mb-0"><strong>Collocations:</strong> {e.collocations.join(" · ")}</p> : null}
                {e.synonyms?.length ? <p className="mb-0"><strong>Similar:</strong> {e.synonyms.join(" · ")}</p> : null}
                {e.registerNote && <p className="mb-0"><strong>Register:</strong> {e.registerNote}</p>}
                {e.mistakes?.map((m) => <p key={m} className="mb-0"><strong>Watch out:</strong> {m}</p>)}
                {e.italian && <p className="mb-0"><strong>For Italian speakers:</strong> {e.italian}</p>}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
