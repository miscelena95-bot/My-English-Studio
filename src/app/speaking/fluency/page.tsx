import type { Metadata } from "next";
import { FLUENCY_DRILLS } from "@/content/speaking/scenarios";
import { CardLink, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Fluency drills" };

export default function DrillsPage() {
  return (
    <div className="page">
      <PageHeader breadcrumbs={[{ href: "/speaking", label: "Speaking Studio" }]} eyebrow="Fluency drills" title="Short, timed, out loud" lede="Speak for 30–90 seconds without stopping. Use the microphone where your browser supports it, or type as fast as you'd speak. These work without the AI tutor; AI feedback is optional." />
      <div className="grid-auto">
        {FLUENCY_DRILLS.map((d) => (
          <CardLink key={d.id} href={`/speaking/fluency/${d.id}`}>
            <h3>{d.title}</h3>
            <p className="small muted mb-0">{d.prompt}</p>
            <div className="card-meta"><span>{d.seconds} seconds</span>{d.keywords && <span>{d.keywords.length} keywords</span>}{d.targets && <span>{d.targets.length} target expressions</span>}</div>
          </CardLink>
        ))}
      </div>
    </div>
  );
}
