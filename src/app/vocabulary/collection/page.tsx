import { nowMs } from "@/lib/format";
import type { Metadata } from "next";
import { listCollection } from "@/lib/server/vocabulary";
import { describeInterval } from "@/lib/domain/srs";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CollectionList } from "@/components/vocab/CollectionList";

export const metadata: Metadata = { title: "Saved expressions" };

export default async function CollectionPage() {
  const now = nowMs();
  const rows = (await listCollection()).map((e) => ({
    id: e.id,
    phrase: e.phrase,
    definition: e.definition,
    mastery: e.schedule?.mastery ?? "new",
    due: !!e.schedule && e.schedule.dueAt.getTime() <= now,
    next: e.schedule ? describeInterval((e.schedule.dueAt.getTime() - now) / 86400000) : "",
    source: e.source,
    timesUsed: e.timesUsed,
    tags: e.tags,
  }));
  return (
    <div className="page">
      <PageHeader breadcrumbs={[{ href: "/vocabulary", label: "Vocabulary Lab" }]} eyebrow="Your collection" title="Saved expressions" lede="Everything you've saved from lessons, conversations, writing feedback and authentic content.">
        <div className="row"><ButtonLink href="/vocabulary/review" variant="primary">Review due</ButtonLink><ButtonLink href="/vocabulary/add">Add an expression</ButtonLink></div>
      </PageHeader>
      {rows.length ? <CollectionList rows={rows} /> : <EmptyState title="Nothing saved yet" action={<ButtonLink href="/vocabulary">Browse expression sets</ButtonLink>}>Save expressions from any module and they&apos;ll be scheduled for review.</EmptyState>}
    </div>
  );
}
