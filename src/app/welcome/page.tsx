import type { Metadata } from "next";
import { getProfile } from "@/lib/server/profile";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  const p = getProfile();
  return (
    <div className="page page-narrow">
      <PageHeader
        eyebrow="Welcome to your studio"
        title="Let's make English something you use, not just understand."
        lede="Four quick questions so your sessions fit your work, your interests and your time. Everything is pre-filled with sensible defaults and can be changed later."
      />
      <OnboardingForm defaults={p} />
    </div>
  );
}
