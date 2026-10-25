import type { Metadata } from "next";
import Link from "next/link";
import { latestNews, NEWS_SECTIONS, newsConfigured } from "@/lib/server/news";
import { REAL_ENGLISH_UNITS } from "@/content/real-english";
import { aiStatus } from "@/lib/ai";
import { formatDateTime } from "@/lib/format";
import { Card, CardLink, Notice, PageHeader } from "@/components/ui";
import { IconExternal } from "@/components/ui/icons";

export const metadata: Metadata = { title: "News" };

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const requested = (await searchParams).section;
  const section = NEWS_SECTIONS.find((s) => s.id === requested)?.id ?? "world";
  const configured = newsConfigured();
  const news = configured ? await latestNews(section) : { items: [], error: "not-configured", cached: false };
  const evergreen = REAL_ENGLISH_UNITS.filter((u) => u.category === "news" || u.category === "business");
  return (
    <div className="page">
      <PageHeader breadcrumbs={[{ href: "/real-english", label: "Real English" }]} eyebrow="News & current affairs" title="Read the news, then talk about it" lede="Headlines, dates and links come straight from the source. Activities are built only from the article's own text — nothing is invented." />
      {!configured ? (
        <div className="stack-l">
          <Notice tone="info" title="Live news isn't configured">
            Add a free <code>GUARDIAN_API_KEY</code> to <code>.env.local</code> to see recent articles here (<Link href="/settings">details in Settings</Link>). Until then, use the prepared activities below, or <Link href="/real-english#add">add an article you&apos;re reading</Link>.
          </Notice>
          <div className="grid-2">{evergreen.map((u) => <CardLink key={u.id} href={`/real-english/${u.id}`}><h3>{u.title}</h3><p className="small muted mb-0">{u.objective}</p></CardLink>)}</div>
        </div>
      ) : (
        <div className="stack">
          <nav className="tabs" aria-label="Sections">{NEWS_SECTIONS.map((s) => <Link key={s.id} href={`/real-english/news?section=${s.id}`} className="tab" aria-current={s.id === section ? "page" : undefined}>{s.label}</Link>)}</nav>
          {news.error && <Notice tone="warning">{news.error}</Notice>}
          {news.items.length === 0 && !news.error && <Notice>No articles found in this section right now.</Notice>}
          {news.items.map((a) => (
            <Card key={a.id} className="stack-s">
              <h3 className="mb-0">{a.title}</h3>
              <span className="small muted">{a.sourceName} · {a.publishedAt ? formatDateTime(a.publishedAt) : "date unknown"}</span>
              {a.summary && <p className="mb-0">{a.summary}</p>}
              <div className="row">
                {a.url && <a className="btn btn-small" href={a.url} target="_blank" rel="noreferrer">Read at the source <IconExternal size={14} /></a>}
                <Link className="btn btn-small btn-primary" href={`/real-english/resources/${a.id}`}>{aiStatus().configured ? "Practise with this article" : "Respond to this article"}</Link>
              </div>
            </Card>
          ))}
          <p className="tiny muted">Powered by the Guardian Open Platform. Content © Guardian News & Media; used under the developer terms with attribution and links.</p>
        </div>
      )}
    </div>
  );
}
