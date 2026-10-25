import type { Metadata } from "next";
import Link from "next/link";
import { desc, notLike } from "drizzle-orm";
import { CATEGORY_INFO, REAL_ENGLISH_UNITS, type RealEnglishCategory } from "@/content/real-english";
import { getDb, schema } from "@/lib/db";
import { getProfile } from "@/lib/server/profile";
import { newsConfigured } from "@/lib/server/news";
import { Badge, Card, CardLink, PageHeader, SectionHead } from "@/components/ui";
import { AddResourceForm } from "@/components/content/ResourceClients";

export const metadata: Metadata = { title: "Real English" };

export default function RealEnglishPage() {
  const profile = getProfile();
  const progress = new Map(getDb().select().from(schema.contentProgress).all().map((p) => [p.contentId, p]));
  const resources = getDb().select().from(schema.contentResources).where(notLike(schema.contentResources.kind, "news:%")).orderBy(desc(schema.contentResources.createdAt)).all();
  const interests = new Set(profile.interests);
  const cats = (Object.keys(CATEGORY_INFO) as RealEnglishCategory[]).sort((a, b) => Number(!interests.has(CATEGORY_INFO[a].interest)) - Number(!interests.has(CATEGORY_INFO[b].interest)));
  return (
    <div className="page">
      <PageHeader eyebrow="Real English" title="Authentic content, active language" lede="Every unit has a language objective: discover the topic, learn key expressions, read or listen, check understanding, practise, discuss — then produce your own response." />
      <div className="grid-3" style={{ marginBottom: 32 }}>
        <CardLink href="/real-english/news">
          <h3>News & current affairs</h3>
          <p className="small muted mb-0">{newsConfigured() ? "Recent articles from The Guardian, with dates, attribution and links." : "Live news isn't configured — see prepared activities and how to enable it."}</p>
        </CardLink>
        <CardLink href="/real-english/challenges">
          <h3>Games & challenges</h3>
          <p className="small muted mb-0">Expression of the day, a 90-second vocabulary sprint, word formation, sentence building and a weekly mission.</p>
        </CardLink>
        <Card>
          <h3>Your own resources</h3>
          <p className="small muted mb-0">Add an article, podcast or video you&apos;re following and turn it into practice.</p>
          <a href="#add" className="small">Add a resource</a>
        </Card>
      </div>
      {cats.map((c) => {
        const units = REAL_ENGLISH_UNITS.filter((u) => u.category === c);
        if (!units.length) return null;
        return (
          <section key={c} style={{ marginBottom: 32 }}>
            <SectionHead title={CATEGORY_INFO[c].label} action={interests.has(CATEGORY_INFO[c].interest) ? <Badge tone="clay">Your interest</Badge> : undefined} />
            <div className="grid-auto">
              {units.map((u) => (
                <CardLink key={u.id} href={`/real-english/${u.id}`}>
                  <h3>{u.title}</h3>
                  <p className="small muted mb-0">{u.objective}</p>
                  <div className="card-meta"><span>{u.skill}</span><span>{u.minutes} min</span><span>{u.level}</span>{progress.get(u.id)?.completedAt && <span style={{ color: "var(--success)" }}>completed</span>}</div>
                </CardLink>
              ))}
            </div>
          </section>
        );
      })}
      <section id="add" style={{ marginTop: 40 }}>
        <SectionHead title="Your resources" />
        <div className="grid-2">
          <Card><AddResourceForm /></Card>
          <Card className="stack-s">
            {resources.length ? (
              <ul className="list small">{resources.map((r) => <li key={r.id}><Link href={`/real-english/resources/${r.id}`}><strong>{r.title}</strong></Link> <span className="muted">· {r.kind}</span></li>)}</ul>
            ) : <p className="small muted mb-0">Nothing added yet.</p>}
          </Card>
        </div>
      </section>
    </div>
  );
}
