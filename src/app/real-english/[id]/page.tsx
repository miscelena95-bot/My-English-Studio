import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getUnit, CATEGORY_INFO } from "@/content/real-english";
import { aiStatus } from "@/lib/ai";
import { getDb, schema } from "@/lib/db";
import { getProfile } from "@/lib/server/profile";
import { listCollection } from "@/lib/server/vocabulary";
import { PageHeader } from "@/components/ui";
import { UnitRunner } from "@/components/content/UnitRunner";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: getUnit((await params).id)?.title ?? "Real English" };
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const unit = getUnit((await params).id);
  if (!unit) notFound();
  const p = getProfile();
  const prog = getDb().select().from(schema.contentProgress).where(eq(schema.contentProgress.contentId, unit.id)).get();
  const saved = listCollection().map((e) => e.libraryId).filter(Boolean) as string[];
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/real-english", label: "Real English" }]} eyebrow={`${CATEGORY_INFO[unit.category].label} · ${unit.skill} · ${unit.minutes} min`} title={unit.title} lede={unit.objective} />
      <UnitRunner unit={unit} aiConfigured={aiStatus().configured} savedKeys={saved} voiceName={p.voiceName} rate={p.speechRate} completed={!!prog?.completedAt} />
    </div>
  );
}
