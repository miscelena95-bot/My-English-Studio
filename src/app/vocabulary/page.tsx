import type { Metadata } from "next";
import Link from "next/link";
import { THEME_LABELS, VOCAB_SETS } from "@/content/vocabulary";
import { collectionStats, listCollection } from "@/lib/server/vocabulary";
import { ButtonLink, Card, CardLink, PageHeader, ProgressBar, SectionHead, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Vocabulary Lab" };

export default function VocabularyPage() {
  const stats = collectionStats();
  const collection = listCollection();
  const bySet = new Map<string, number>();
  for (const e of collection) if (e.setId) bySet.set(e.setId, (bySet.get(e.setId) ?? 0) + 1);
  const themes = Object.keys(THEME_LABELS) as Array<keyof typeof THEME_LABELS>;
  return (
    <div className="page">
      <PageHeader eyebrow="Vocabulary Lab" title="Words you can actually use" lede="Expressions are taught as usable chunks, reviewed with spaced repetition, and counted as “active” only when you use them in your own speaking or writing." />
      <div className="grid-3" style={{ marginBottom: 32 }}>
        <Card className="stack">
          <div className="card-title">Your collection</div>
          <div className="row-between">
            <Stat value={stats.total} label="expressions" />
            <Stat value={stats.mastered} label="mastered" />
            <Stat value={stats.usedActively} label="used actively" />
          </div>
          <ProgressBar value={stats.mastered} max={Math.max(1, stats.total)} label="Mastered share" thin />
          <Link href="/vocabulary/collection" className="small">Browse and search your collection</Link>
        </Card>
        <Card className="stack">
          <div className="card-title">Spaced repetition</div>
          <Stat value={stats.due} label="due now" />
          <ButtonLink href="/vocabulary/review" variant={stats.due ? "primary" : "secondary"} size="small">{stats.due ? "Start review" : "Nothing due"}</ButtonLink>
          <span className="tiny muted">Reviews move from recognising → recalling → using each expression as it matures.</span>
        </Card>
        <Card className="stack">
          <div className="card-title">Your own expressions</div>
          <p className="small muted mb-0">Met something useful in a film, a meeting or an email? Add it — and save expressions straight from feedback in Speaking, Writing and Real English.</p>
          <ButtonLink href="/vocabulary/add" size="small">Add an expression</ButtonLink>
        </Card>
      </div>
      {themes.map((theme) => {
        const sets = VOCAB_SETS.filter((s) => s.theme === theme);
        if (!sets.length) return null;
        return (
          <section key={theme} className="section" style={{ marginTop: 32 }}>
            <SectionHead title={THEME_LABELS[theme]} />
            <div className="grid-auto">
              {sets.map((s) => (
                <CardLink key={s.id} href={`/vocabulary/sets/${s.id}`}>
                  <h3>{s.title}</h3>
                  <p className="small muted mb-0">{s.description}</p>
                  <div className="card-meta">
                    <span>{s.entries.length} expressions</span>
                    <span>{s.exercises.length} exercises</span>
                    {bySet.get(s.id) ? <span style={{ color: "var(--success)" }}>{bySet.get(s.id)} in collection</span> : null}
                  </div>
                </CardLink>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
