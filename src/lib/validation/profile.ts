import { z } from "zod";

export const LEVELS = ["A2", "B1", "B1+", "B2", "B2+", "C1"] as const;
export const CORRECTION_STYLES = ["adaptive", "fluency", "coaching", "precision"] as const;
export const STRUCTURE_BALANCES = ["guided", "mixed", "explore"] as const;
export const SPEAKING_MODES = ["text", "voice", "both"] as const;

export const GOAL_OPTIONS = [
  "Speak more fluently and spontaneously",
  "Write clear, natural English",
  "Use more vocabulary actively",
  "Improve grammatical accuracy",
  "Discuss culture, news and ideas",
  "Communicate confidently at work",
  "Build a daily learning habit",
] as const;

export const INTEREST_OPTIONS = [
  "Current affairs",
  "Television",
  "Films",
  "Music",
  "Literature",
  "Travel",
  "Culture",
  "Psychology",
  "Personal development",
  "Business English",
  "Quizzes and games",
  "Technology",
] as const;

export const PROFESSIONAL_OPTIONS = [
  "Emails and professional writing",
  "Event planning",
  "Client interactions",
  "Meetings",
  "Presentations",
  "Negotiations",
  "Job interviews",
  "Career development",
  "Everyday conversation",
] as const;

export const DEFAULT_PROFILE = {
  selfAssessedLevel: "B1+" as (typeof LEVELS)[number],
  goals: [...GOAL_OPTIONS],
  sessionMinutes: 25,
  correctionStyle: "adaptive" as (typeof CORRECTION_STYLES)[number],
  interests: [...INTEREST_OPTIONS],
  professionalFocus: [...PROFESSIONAL_OPTIONS],
  structureBalance: "mixed" as (typeof STRUCTURE_BALANCES)[number],
  speakingMode: "both" as (typeof SPEAKING_MODES)[number],
  weeklyGoalMinutes: 150,
  weeklyGoalSessions: 5,
};

const trimmedList = (allowed: readonly string[]) =>
  z
    .array(z.string())
    .transform((xs) => Array.from(new Set(xs.filter((x) => allowed.includes(x)))));

export const ProfileUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .max(40, "Please use 40 characters or fewer.")
    .optional()
    .transform((v) => (v ? v : null)),
  selfAssessedLevel: z.enum(LEVELS),
  goals: trimmedList(GOAL_OPTIONS).refine((g) => g.length > 0, "Choose at least one goal."),
  sessionMinutes: z.coerce.number().int().min(10, "Sessions are at least 10 minutes.").max(60, "Sessions are at most 60 minutes."),
  correctionStyle: z.enum(CORRECTION_STYLES),
  interests: trimmedList(INTEREST_OPTIONS),
  professionalFocus: trimmedList(PROFESSIONAL_OPTIONS),
  structureBalance: z.enum(STRUCTURE_BALANCES),
  speakingMode: z.enum(SPEAKING_MODES),
  weeklyGoalMinutes: z.coerce.number().int().min(30).max(840),
  weeklyGoalSessions: z.coerce.number().int().min(1).max(14),
  showStreak: z.coerce.boolean(),
  storeTranscripts: z.coerce.boolean(),
  breakUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

/** Parse checkbox-style FormData into the shape ProfileUpdateSchema expects. */
export function profileFromFormData(fd: FormData) {
  return {
    name: String(fd.get("name") ?? ""),
    selfAssessedLevel: String(fd.get("selfAssessedLevel") ?? "B1+"),
    goals: fd.getAll("goals").map(String),
    sessionMinutes: fd.get("sessionMinutes"),
    correctionStyle: String(fd.get("correctionStyle") ?? "adaptive"),
    interests: fd.getAll("interests").map(String),
    professionalFocus: fd.getAll("professionalFocus").map(String),
    structureBalance: String(fd.get("structureBalance") ?? "mixed"),
    speakingMode: String(fd.get("speakingMode") ?? "both"),
    weeklyGoalMinutes: fd.get("weeklyGoalMinutes") ?? 150,
    weeklyGoalSessions: fd.get("weeklyGoalSessions") ?? 5,
    showStreak: fd.get("showStreak") === "on",
    storeTranscripts: fd.get("storeTranscripts") === "on",
    breakUntil: fd.get("breakUntil") ? String(fd.get("breakUntil")) : null,
  };
}
