import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_PROFILE, type ProfileUpdate } from "@/lib/validation/profile";

export type Profile = typeof schema.learnerProfile.$inferSelect;

export function getProfile(): Profile {
  const db = getDb();
  const row = db.select().from(schema.learnerProfile).where(eq(schema.learnerProfile.id, 1)).get();
  if (row) return row;
  db.insert(schema.learnerProfile).values({ id: 1, ...DEFAULT_PROFILE }).run();
  return db.select().from(schema.learnerProfile).where(eq(schema.learnerProfile.id, 1)).get()!;
}

export function updateProfile(update: Partial<ProfileUpdate> & Partial<Pick<Profile, "estimatedLevel" | "levelEvidence" | "onboardingCompletedAt" | "diagnosticCompletedAt" | "voiceName" | "speechRate">>) {
  getProfile();
  getDb()
    .update(schema.learnerProfile)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(schema.learnerProfile.id, 1))
    .run();
  return getProfile();
}

export function isOnboarded(p: Profile = getProfile()) {
  return p.onboardingCompletedAt != null;
}
