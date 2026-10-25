import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { AddExpressionForm } from "@/components/vocab/AddExpressionForm";

export const metadata: Metadata = { title: "Add an expression" };

export default function AddPage() {
  return (
    <div className="page page-narrow">
      <PageHeader breadcrumbs={[{ href: "/vocabulary", label: "Vocabulary Lab" }]} eyebrow="Personal collection" title="Add an expression" lede="If it's already in the library, the full entry (examples, collocations, Italian-speaker notes) is used automatically." />
      <AddExpressionForm />
    </div>
  );
}
