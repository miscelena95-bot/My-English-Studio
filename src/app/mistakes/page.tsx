import type { Metadata } from "next";
import Link from "next/link";
import { getMistake, listMistakes } from "@/lib/server/mistakes";
import { mistakeCategorySummary } from "@/lib/server/insights";
import { CATEGORY_LABELS, type MistakeCategory } from "@/lib/domain/mistake-categories";
import { formatDate } from "@/lib/format";
import { ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { MistakeRow } from "@/components/mistakes/MistakeRow";

export const metadata: Metadata = { title: "Mistake tracker" };

export default async function MistakesPage({ searchParams }: { searchParams: Promise<{ category?: string; status?: string }> }) {
  const sp = await searchParams;
  const all = listMistakes();
  const cats = mistakeCategorySummary();
  const status = sp.status ?? "open";
  const list = all.filter((m) => (!sp.category || m.category === sp.category) && (status === "all" ? true : status === "open" ? m.status !== "resolved" : m.status === status));
  const href = (q: Record<string, string | undefined>) => `/mistakes?${new URLSearchParams(Object.entries({ category: sp.category, status, ...q }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <div className="page">
      <PageHeader eyebrow="Mistake tracker" title="Your mistakes, your best teachers" lede="Collected from exercises, conversations and writing. Repeated mistakes are grouped, practised with your own sentences, and checked again later in a different context.">
        <ButtonLink href="/mistakes/practice" variant="primary">Practise high-value mistakes</ButtonLink>
      </PageHeader>
      {all.length === 0 ? (
        <EmptyState title="No mistakes tracked yet">Mistakes appear here automatically when you answer exercises incorrectly or receive feedback on speaking and writing. That&apos;s a good thing: they show exactly what to practise.</EmptyState>
      ) : (
        <div className="dash-grid">
          <div className="stack">
            <div className="tabs" role="navigation" aria-label="Filter by status">
              {[["open", "Active & improving"], ["resolved", "Resolved"], ["all", "All"]].map(([v, l]) => (
                <Link key={v} href={href({ status: v })} className="tab" aria-current={status === v ? "page" : undefined}>{l}</Link>
              ))}
            </div>
            {sp.category && <p className="small">Showing {CATEGORY_LABELS[sp.category as MistakeCategory] ?? sp.category} · <Link href={href({ category: undefined })}>show all categories</Link></p>}
            {list.length ? (
              <Card style={{ padding: "8px 20px" }}>
                <ul className="list">
                  {list.map((m) => {
                    const d = getMistake(m.id)!;
                    return (
                      <MistakeRow
                        key={m.id}
                        m={{
                          id: m.id,
                          original: m.original,
                          corrected: m.corrected,
                          explanation: m.explanation,
                          categoryLabel: CATEGORY_LABELS[m.category as MistakeCategory] ?? m.category,
                          status: m.status,
                          severity: m.severity,
                          occurrences: m.occurrences,
                          practiceCount: m.practiceCount,
                          practiceCorrect: m.practiceCorrect,
                          source: m.source,
                          context: m.context,
                          lastSeen: formatDate(m.lastSeenAt),
                          firstSeen: formatDate(m.firstSeenAt),
                          events: d.events.slice(0, 10).map((e) => ({ type: e.type, when: formatDate(e.createdAt), text: e.text })),
                        }}
                      />
                    );
                  })}
                </ul>
              </Card>
            ) : (
              <EmptyState title="Nothing in this view">{status === "resolved" ? "Resolved mistakes appear here after you get them right on two different days." : "Nice — nothing active here."}</EmptyState>
            )}
          </div>
          <aside className="stack">
            <Card className="stack">
              <div className="card-title">Overview</div>
              <div className="row-between">
                <Stat value={all.filter((m) => m.status === "active").length} label="active" />
                <Stat value={all.filter((m) => m.status === "improving").length} label="improving" />
                <Stat value={all.filter((m) => m.status === "resolved").length} label="resolved" />
              </div>
            </Card>
            <Card className="stack-s">
              <div className="card-title">By category</div>
              <ul className="list small">
                {cats.map((c) => (
                  <li key={c.category} className="row-between">
                    <Link href={href({ category: c.category })}>{c.label}</Link>
                    <span className="muted">{c.active} active · ×{c.occurrences}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
