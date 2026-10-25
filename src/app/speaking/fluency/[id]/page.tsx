import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDrill } from "@/content/speaking/scenarios";
import { aiStatus } from "@/lib/ai";
import { PageHeader } from "@/components/ui";
import { DrillClient } from "@/components/speaking/DrillClient";

export const metadata: Metadata = { title: "Fluency drill" };

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const d = getDrill((await params).id);
  if (!d) notFound();
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/speaking", label: "Speaking Studio" }, { href: "/speaking/fluency", label: "Fluency drills" }]} eyebrow="Fluency drill" title={d.title} />
      <DrillClient drill={d} aiConfigured={aiStatus().configured} />
    </div>
  );
}
