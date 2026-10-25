import type { Metadata } from "next";
import { DIAGNOSTIC_ITEMS, DIAGNOSTIC_SPEAKING, DIAGNOSTIC_WRITING, SELF_ASSESSMENT_SKILLS } from "@/content/diagnostic";
import { aiStatus } from "@/lib/ai";
import { Diagnostic } from "@/components/onboarding/Diagnostic";
import { PageHeader } from "@/components/ui";
import { GRAMMAR_TOPICS } from "@/content/grammar";

export const metadata: Metadata = { title: "Diagnostic" };

export default function DiagnosticPage() {
  return (
    <div className="page page-narrow">
      <PageHeader eyebrow="Initial diagnostic" title="Where are you starting from?" lede="A provisional profile to personalise your sessions. You can retake it at any time from My Progress." />
      <Diagnostic items={DIAGNOSTIC_ITEMS} writingPrompt={DIAGNOSTIC_WRITING.prompt} speakingPrompt={DIAGNOSTIC_SPEAKING.prompt} skills={SELF_ASSESSMENT_SKILLS} aiConfigured={aiStatus().configured} topicTitles={Object.fromEntries(GRAMMAR_TOPICS.map((t) => [t.id, t.title]))} />
    </div>
  );
}
