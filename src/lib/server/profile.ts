import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_PROFILE, type ProfileUpdate } from "@/lib/validation/profile";

export type Profile = typeof schema.learnerProfile.$inferSelect;

export async function getProfile(): Promise<Profile> {
  const db = getDb();
  const row = await db.select().from(schema.learnerProfile).where(eq(schema.learnerProfile.id, 1)).get();
  if (row) return row;
  await db.insert(schema.learnerProfile).values({ id: 1, ...DEFAULT_PROFILE }).onConflictDoNothing().run();
  return (await db.select().from(schema.learnerProfile).where(eq(schema.learnerProfile.id, 1)).get())!;
}

export async function updateProfile(
  update: Partial<ProfileUpdate> & Partial<Pick<Profile, "estimatedLevel" | "levelEvidence" | "onboardingCompletedAt" | "diagnosticCompletedAt" | "voiceName" | "speechRate">>,
) {
  await getProfile();
  await getDb()
    .update(schema.learnerProfile)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(schema.learnerProfile.id, 1))
    .run();
  return getProfile();
}

export function isOnboarded(p: Profile) {
  return p.onboardingCompletedAt != null;
}
